import { chat, extractJSON, MODELS, parkedFor } from './llm.mjs';
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

// Markers instead of JSON. The run of 2026-10-31 23:03 spent 42 minutes and
// wrote two German editions, and almost every failure was the same one: both
// models that answer at all (minimax, step-5) thought out loud — "The user
// wants only raw valid JSON ... Let me translate carefully: Title: ..." — and
// ran out of answer before the JSON began. The JSON brackets and escaping are
// what they stumble over. A line marker needs no escaping, keeps the paragraph
// count visible, and whatever the model says before the first marker is
// dropped instead of failing the language.
const stripThink = (t) => String(t ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');

const unquote = (v) => (v.length > 1 && /^["“'']/.test(v) && /["”'']$/.test(v) ? v.slice(1, -1).trim() : v);

function parseHead(text) {
  const raw = stripThink(text);
  const found = {};
  let field = null;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*@@\s*(TITLE|DEK|FACTS|CONTEXT|CAPTION)\s*@@\s*:?\s*/i);
    if (m) {
      field = m[1].toUpperCase();
      found[field] = line.slice(m[0].length).trim();
      continue;
    }
    if (field && line.trim()) found[field] = `${found[field]} ${line.trim()}`.trim();
  }
  const value = (k) => {
    const v = unquote(String(found[k] || '').trim());
    return /^(nothing|none|none\.|keine angaben|keine|n\/a|—|-)$/i.test(v) ? '' : v;
  };
  const blocks = { title: value('TITLE'), dek: value('DEK'), context: value('CONTEXT'), imageCaption: value('CAPTION') };
  const facts = value('FACTS');
  if (!blocks.title || !blocks.dek) {
    // A model that ignored the markers but answered JSON anyway.
    try {
      const d = extractJSON(raw);
      if (d && typeof d.title === 'string' && d.title.trim()) {
        return { title: d.title, dek: d.dek || '', facts: Array.isArray(d.facts) ? d.facts : [], context: d.context || '', imageCaption: d.imageCaption || '' };
      }
    } catch {}
  }
  return { ...blocks, facts: facts ? facts.split(/\s*\|\|\s*/).map((s) => unquote(s.trim())).filter(Boolean) : [] };
}

function parseParagraphs(text) {
  const raw = stripThink(text);
  const parts = [];
  let cur = null;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*@@\s*P\s*@@\s*/i);
    if (m) {
      if (cur !== null && cur.trim()) parts.push(cur.trim());
      cur = line.slice(m[0].length);
      continue;
    }
    if (cur !== null) cur += `${cur.trim() ? ' ' : ''}${line.trim()}`;
  }
  if (cur !== null && cur.trim()) parts.push(cur.trim());
  if (!parts.length) {
    try {
      const d = extractJSON(raw);
      if (Array.isArray(d?.body)) return d.body.map(String);
    } catch {}
  }
  return parts;
}

// NVIDIA's free tier answers a second call of the same model while the first
// one is still running with 429: three workers produced 94 rate-limit replies
// in 42 minutes on 2026-10-31, and each one cost an article. One call per model
// at a time turns those refusals into a queue.
const busy = new Map();
const exclusive = (model, run) => {
  const prev = busy.get(model) || Promise.resolve();
  const next = prev.then(run, run);
  busy.set(model, next.catch(() => {}));
  return next;
};

/**
 * Translate one article (source-language fields) into `locale`. Validates the
 * result. `models` overrides the chain, which only the probe needs.
 */
const registerFor = (locale) => {
  const lang = LOCALES.find((l) => l.code === locale);
  return `You are a professional news translator. Translate into ${lang.label} (${lang.bcp47}) in the neutral register of a quality newspaper in that language. Keep meaning exact. Do not add or remove information. Keep names, numbers and quotes accurate; use the established local spelling of place and person names. Translate the meaning, not the words: no literal renderings of English stock phrases, and keep the sentence rhythm of the target language rather than mirroring English syntax.${terminologyFor(locale)} Write the translation itself; do not explain, comment on or plan the work.`;
};

/** The head request exactly as a translation run sends it — the probe needs it. */
export function headMessages(src, locale) {
  return [
    {
      role: 'system',
      content: `${registerFor(locale)}

Reply with these five blocks, in this order, and nothing else. Each block starts on its own line with its marker, exactly as written here:
@@TITLE@@ the translated headline
@@DEK@@ the translated standfirst
@@FACTS@@ the translated facts, separated by " || ", in the same order, or NOTHING
@@CONTEXT@@ the translated closing context, or NOTHING
@@CAPTION@@ the translated image caption, or NOTHING`,
    },
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
  ];
}

/** The body request exactly as a translation run sends it. */
export function bodyMessages(src, paragraphs, locale, title = src.title) {
  return [
    {
      role: 'system',
      content: `${registerFor(locale)}

This is the body of one article. Translate every paragraph. Write a line containing exactly @@P@@ before each translated paragraph, keep exactly ${paragraphs.length} paragraphs in the same order, never merge or split one, and write nothing before the first @@P@@.`,
    },
    {
      role: 'user',
      content: JSON.stringify({ title, paragraphs }),
    },
  ];
}

export async function translate(src, locale, models = null) {
  const chain = [...new Set(models?.length ? models : MODELS.translator)];
  // A chunk is a small answer, and a small answer takes a short wait. This is
  // also what the probe raises when it wants to know whether a model finishes
  // at all, instead of guessing from a timeout.
  const perCall = Number(process.env.TRANSLATE_TIMEOUT_MS) || 150_000;
  // Half the source length is enough for the translation; the extra 400 tokens
  // are for the model that thinks out loud before the text, whose answer was
  // cut off mid-sentence at a 600-token budget and lost the whole part.
  const maxTokens = Number(process.env.TRANSLATE_MAX_TOKENS) || 0;
  const budgetFor = (chars) => maxTokens || Math.min(2500, Math.max(700, Math.ceil(chars / 2) + 400));
  const debug = Boolean(process.env.TRANSLATE_DEBUG);

  const register = registerFor(locale);

  let ollamaOutOfQuota = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Ask the chain until one model answers for this step. */
  const ask = async (messages, what, chars) => {
    let lastErr;
    for (let pass = 0; pass < 2; pass++) {
      let tried = false;
      for (const model of chain) {
        if (ollamaOutOfQuota && model.startsWith('ollama/')) continue;
        // A model that timed out or hit a rate limit two seconds ago answers
        // nothing now. Asking it anyway cost the run of 2026-10-31 21:54
        // every locale after the first 429.
        if (parkedFor(model)) continue;
        tried = true;
        const started = Date.now();
        try {
          const { text } = await exclusive(model, () => chat('translator', messages, {
            temperature: 0.2,
            maxTokens: budgetFor(chars),
            models: [model],
            timeoutMs: perCall,
            // Measured on 2026-11-01 with the article that kept failing: the
            // same request without a hint narrated for 123 s and 7 900
            // characters and never wrote a marker ("We need produce exactly
            // five blocks ..."), while `reasoning_effort: low` answered the
            // five blocks in 39 s. `none` and `minimal` also work and take
            // 122 s and 82 s. Providers that do not know the field ignore it.
            extra: { reasoning_effort: process.env.TRANSLATE_REASONING_EFFORT || 'low' },
          }));
          if (debug) console.log(`  ${what}: ${model} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
          return { text, model };
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
  const headAnswer = await ask(
    headMessages(src, locale),
    `${locale} head`,
    [src.title, src.dek, ...(src.facts || []), src.context, src.imageCaption].join('').length,
  ).catch((e) => {
    throw new Error(`translation ${locale} failed — ${e.message}`);
  });
  const h = parseHead(headAnswer.text);
  if (typeof h.title !== 'string' || !h.title.trim()) {
    throw new Error(`translation ${locale} failed — head returned no title`);
  }

  // One call for the whole body when the answer fits a normal budget. Every
  // call cost 65-100 s of queue time on 2026-10-31, so four chunks meant seven
  // minutes per language for one article. The chunk path stays as the fallback
  // for the article whose single answer does not keep its paragraph count.
  const body = Array.isArray(src.body) ? src.body : [];
  // Nine paragraphs is too many for one answer: both such articles answered
  // "1 of 9 paragraphs" on 2026-11-01, and the failed call cost more than the
  // two or three parts that follow it. Four paragraphs arrive whole.
  const wholeBodyLimit = Number(process.env.TRANSLATE_WHOLE_BODY_CHARS) || 4200;

  const chunked = async () => {
    const chunks = bodyChunks(body);
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      const part = chunks[i];
      const { text } = await ask(
        [
          {
            role: 'system',
            content: `${register}

This is part ${i + 1} of ${chunks.length} of one article. Keep the terms and the tone of the other parts. Translate every paragraph and write a line containing exactly @@P@@ before each one: exactly ${part.length} markers, no merging, nothing before the first marker.`,
          },
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
      const parts = parseParagraphs(text);
      if (parts.length !== part.length) {
        throw new Error(
          `translation ${locale} failed — part ${i + 1}/${chunks.length} returned ${parts.length} of ${part.length} paragraphs`,
        );
      }
      out.push(...parts);
    }
    return out;
  };

  const whole = async () => {
    if (!body.length) return [];
    if (body.join(' ').length > wholeBodyLimit) throw new Error(`${body.join(' ').length} characters is too much for one answer`);
    const { text } = await ask(bodyMessages(src, body, locale, h.title), `${locale} body`, body.join(' ').length);
    const parts = parseParagraphs(text);
    if (parts.length !== body.length) {
      throw new Error(`one answer returned ${parts.length} of ${body.length} paragraphs`);
    }
    return parts;
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
