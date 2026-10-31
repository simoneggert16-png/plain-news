import { chatJSON, MODELS } from './llm.mjs';
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
  const perCall = Number(process.env.TRANSLATE_TIMEOUT_MS) || 90_000;
  // A model that is given room rambles until the room is gone: on 2026-10-31 a
  // model was handed a headline, a standfirst and five facts, and did not
  // return within 300 s with a 10 000-token budget. The budget is now what the
  // answer needs, three characters to the token, and the prompt says out loud
  // that the answer is a document and not a monologue.
  const maxTokens = Number(process.env.TRANSLATE_MAX_TOKENS) || 0;
  const budgetFor = (chars) => maxTokens || Math.min(3000, Math.max(600, Math.ceil(chars / 2)));
  const debug = Boolean(process.env.TRANSLATE_DEBUG);

  const register = `You are a professional news translator. Translate into ${lang.label} (${lang.bcp47}) in the neutral register of a quality newspaper in that language. Keep meaning exact. Do not add or remove information. Keep names, numbers and quotes accurate; use the established local spelling of place and person names. Translate the meaning, not the words: no literal renderings of English stock phrases, and keep the sentence rhythm of the target language rather than mirroring English syntax.${terminologyFor(locale)} Answer with the JSON document only: no reasoning, no explanation, no markdown.`;

  let ollamaOutOfQuota = false;
  /** Ask the chain until one model returns parseable JSON for this step. */
  const ask = async (messages, what, chars) => {
    let lastErr;
    for (const model of chain) {
      if (ollamaOutOfQuota && model.startsWith('ollama/')) continue;
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

  const body = Array.isArray(src.body) ? src.body : [];
  const chunks = bodyChunks(body);
  const out = [];
  for (let i = 0; i < chunks.length; i++) {
    const part = chunks[i];
    const { data } = await ask(
      [
        { role: 'system', content: `${register} This is part ${i + 1} of ${chunks.length} of one article. Keep the terms and the tone of the other parts. Return {"body":[…]}.` },
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
