import { chatJSON, MODELS, parkedFor } from './llm.mjs';
import { terminologyFor, terminologyProblems } from './terminology.mjs';
import { languageProblem } from './langcheck.mjs';
import { LOCALES } from '../../lib/config.mjs';

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Why a model's answer is not a usable translation; empty when it is. */
function translationProblems(src, data, locale) {
  if (!data || typeof data.title !== 'string' || !data.title.trim()) return ['missing title'];
  if (!Array.isArray(data.body) || !data.body.length || data.body.some((p) => typeof p !== 'string' || !p.trim())) {
    return ['missing body'];
  }
  // A translation that keeps the source title froze English into the locale.
  if (norm(data.title).toLowerCase() === norm(src.title).toLowerCase()) return ['returned the source title'];
  if (norm(src.dek) && (!norm(data.dek) || norm(data.dek).toLowerCase() === norm(src.dek).toLowerCase())) {
    return ['returned no usable dek'];
  }
  if (src.facts?.length && (!Array.isArray(data.facts) || data.facts.length !== src.facts.length)) {
    return [`lost facts (${data.facts?.length ?? 0}/${src.facts.length})`];
  }
  // Merged or dropped paragraphs mean information went missing; the prompt
  // asks for the same array lengths for exactly this reason.
  if (Array.isArray(src.body) && data.body.length !== src.body.length) {
    return [`body length ${data.body.length}/${src.body.length}`];
  }
  const flat = [data.title, data.dek, ...(data.facts || []), ...data.body, data.context || ''].join('\n');
  const langProblem = languageProblem(locale, flat);
  if (langProblem) return [langProblem];
  const sourceText = [src.title, src.dek, ...(src.facts || []), ...(src.body || [])].join('\n');
  return terminologyProblems(locale, sourceText, flat);
}

// A single answer of a whole article never arrives. Measured on 2026-10-31:
// every model in the catalogue answers a sentence in 3-16 s, but a 1.9 kB
// article with four paragraphs did not finish in 240 s on any of them, with a
// 2 500 or a 10 000 token budget. The answer length is the wall, so the article
// is translated the way a person would work through it: headline and facts
// first, then two or three paragraphs at a time.
const MAX_CHUNK_CHARS = Number(process.env.TRANSLATE_CHUNK_CHARS) || 900;

function bodyChunks(body) {
  const chunks = [];
  let cur = [];
  let size = 0;
  for (const p of body) {
    const len = String(p).length;
    if (cur.length && size + len > MAX_CHUNK_CHARS) {
      chunks.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += len;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/**
 * Translate one article (source-language fields) into `locale`. Validates the
 * result. `models` overrides the chain, which only the probe needs.
 */
export async function translate(src, locale, models = null) {
  const lang = LOCALES.find((l) => l.code === locale);
  const chain = [...new Set(models?.length ? models : MODELS.translator)];
  // A chunk is a small answer, and a small answer takes a short wait. This is
  // also what the probe raises when it wants to know whether a model finishes
  // at all, instead of guessing from a timeout.
  const perCall = Number(process.env.TRANSLATE_TIMEOUT_MS) || 150_000;
  // A model that is given room rambles until the room is gone, and the
  // provider takes longer the more room it is offered: a 10 000-token answer
  // never came back, a 700-token one came back in 30 s. Half the source length
  // is enough for the translation; the extra 400 tokens are for the model that
  // thinks out loud before the JSON, whose answer was cut off mid-string at a
  // 600-token budget and lost the whole part.
  const maxTokens = Number(process.env.TRANSLATE_MAX_TOKENS) || 0;
  const budgetFor = (chars) => maxTokens || Math.min(2500, Math.max(700, Math.ceil(chars / 2) + 400));
  const debug = Boolean(process.env.TRANSLATE_DEBUG);

  const register = `You are a professional news translator. Translate into ${lang.label} (${lang.bcp47}) in the neutral register of a quality newspaper in that language. Keep meaning exact. Do not add or remove information. Keep names, numbers and quotes accurate; use the established local spelling of place and person names. Translate the meaning, not the words: no literal renderings of English stock phrases, and keep the sentence rhythm of the target language rather than mirroring English syntax.${terminologyFor(locale)} Answer with the JSON document only: no reasoning, no explanation, no markdown.`;

  let ollamaOutOfQuota = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Ask the chain until one model returns parseable JSON for this step. */
  const ask = async (messages, what, chars) => {
    let lastErr;
    for (let pass = 0; pass < 2; pass++) {
      let tried = false;
      for (const model of chain) {
        if (ollamaOutOfQuota && model.startsWith('ollama/')) continue;
        // A model that timed out or hit a rate limit two seconds ago answers
        // nothing now. Asking it anyway cost the whole run of 2026-10-31 21:54
        // every locale after the first 429.
        if (parkedFor(model)) continue;
        tried = true;
        const started = Date.now();
        try {
          const { data } = await chatJSON('translator', messages, {
            temperature: 0.2,
            maxTokens: budgetFor(chars),
            models: [model],
            timeoutMs: perCall,
          });
          if (debug) console.log(`  ${what}: ${model} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
          return { data, model };
        } catch (e) {
          if (debug) console.log(`  ${what}: ${model} failed after ${((Date.now() - started) / 1000).toFixed(1)}s — ${e.message}`);
          if (model.startsWith('ollama/') && /HTTP (402|429)/.test(String(e?.message || ''))) ollamaOutOfQuota = true;
          lastErr = e;
        }
      }
      // Every model is parked. Waiting for the first one to come back is what
      // the call would have cost anyway, and it beats dropping the language.
      const parked = chain.map(parkedFor).filter((ms) => ms > 0);
      const wait = parked.length ? Math.min(...parked) : 0;
      if (tried || !wait || wait > 120_000) break;
      if (debug) console.log(`  ${what}: every model is parked, waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait + 500);
    }
    throw new Error(`${what} rejected by all models (${lastErr?.message})`);
  };

  // Headline, standfirst, facts and the closing context block: short answers,
  // and they set the terms the paragraphs have to keep.
  const head = await ask(
    [
      { role: 'system', content: register },
      {
        role: 'user',
        content: JSON.stringify({
          title: src.title,
          dek: src.dek || '',
          facts: src.facts || [],
          context: src.context || '',
          imageCaption: src.imageCaption || '',
        }),
      },
    ],
    `${locale} head`,
    [src.title, src.dek, ...(src.facts || []), src.context, src.imageCaption].join('').length,
  ).catch((e) => {
    throw new Error(`translation ${locale} failed — ${e.message}`);
  });
  const h = head.data || {};
  if (typeof h.title !== 'string' || !h.title.trim()) {
    throw new Error(`translation ${locale} failed — head returned no title`);
  }

  // One call for the whole body when the answer fits a normal budget. Every
  // call cost 65-100 s of queue time on 2026-10-31, so four chunks meant seven
  // minutes per language for one article. The chunk path stays as the fallback
  // for the article whose single answer does not keep its paragraph count.
  const body = Array.isArray(src.body) ? src.body : [];
  const wholeBodyLimit = Number(process.env.TRANSLATE_WHOLE_BODY_CHARS) || 6000;

  const bodyMessages = (paragraphs, title) => [
    {
      role: 'system',
      content: `${register} This is the body of one article. Return {"body":[…]} with exactly ${paragraphs.length} strings, one per paragraph, in the same order. Never merge or split paragraphs, and never add numbering.`,
    },
    {
      role: 'user',
      content: JSON.stringify({ title, paragraphs }),
    },
  ];

  const chunked = async () => {
    const chunks = bodyChunks(body);
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      const part = chunks[i];
      const { data } = await ask(
        [
          { role: 'system', content: `${register} This is part ${i + 1} of ${chunks.length} of one article. Keep the terms and the tone of the other parts. Return {"body":[…]} with exactly ${part.length} strings, one per paragraph.` },
          {
            role: 'user',
            content: JSON.stringify({
              title: h.title,
              part: `${i + 1}/${chunks.length}`,
              previous: out.length ? String(out[out.length - 1]).slice(-240) : '',
              paragraphs: part,
            }),
          },
        ],
        `${locale} part ${i + 1}/${chunks.length}`,
        part.join(' ').length,
      ).catch((e) => {
        throw new Error(`translation ${locale} failed — ${e.message}`);
      });
      if (!Array.isArray(data?.body) || data.body.length !== part.length) {
        throw new Error(
          `translation ${locale} failed — part ${i + 1}/${chunks.length} returned ${data?.body?.length ?? 0} of ${part.length} paragraphs`,
        );
      }
      out.push(...data.body.map(String));
    }
    return out;
  };

  const whole = async () => {
    if (!body.length) return [];
    if (body.join(' ').length > wholeBodyLimit) throw new Error(`${body.join(' ').length} characters is too much for one answer`);
    const { data } = await ask(bodyMessages(body, h.title), `${locale} body`, body.join(' ').length);
    if (!Array.isArray(data?.body) || data.body.length !== body.length) {
      throw new Error(`one answer returned ${data?.body?.length ?? 0} of ${body.length} paragraphs`);
    }
    return data.body.map(String);
  };

  const out = await whole().catch(async (e) => {
    if (debug) console.log(`  ${locale} body in one answer refused: ${e.message}; splitting it`);
    return chunked();
  });

  const translated = {
    title: h.title,
    dek: h.dek || '',
    facts: Array.isArray(h.facts) ? h.facts : [],
    body: out,
    context: h.context || '',
    imageCaption: h.imageCaption || '',
  };
  const problems = translationProblems(src, translated, locale);
  if (problems.length) throw new Error(`translation ${locale} failed — ${problems.join('; ')}`);
  return translated;
}
