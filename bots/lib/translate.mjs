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

/** Translate one article (source-language fields) into `locale`. Validates the result. */
export async function translate(src, locale) {
  const lang = LOCALES.find((l) => l.code === locale);
  const input = {
    title: src.title,
    dek: src.dek,
    facts: src.facts || [],
    body: src.body,
    context: src.context || '',
    imageCaption: src.imageCaption || '',
  };
  const messages = [
    {
      role: 'system',
      content: `You are a professional news translator. Translate into ${lang.label} (${lang.bcp47}) in the neutral register of a quality newspaper in that language. Keep meaning exact. Do not add or remove information. Keep names, numbers and quotes accurate; use the established local spelling of place and person names.${terminologyFor(locale)} Reply with JSON only, same keys and same array lengths.`,
    },
    { role: 'user', content: JSON.stringify(input) },
  ];

  // Two models at most: the fast default, then the strongest one as a second
  // opinion. A failed check costs one extra call per locale, not a whole run.
  const chain = MODELS.translator.slice(0, 2);
  let lastErr;
  for (const model of [...new Set(chain)]) {
    try {
      const { data } = await chatJSON('translator', messages, { temperature: 0.2, maxTokens: 10000, models: [model] });
      const problems = translationProblems(src, data, locale);
      if (problems.length) throw new Error(`${model}: ${problems.join('; ')}`);
      return {
        title: data.title,
        dek: data.dek || '',
        facts: Array.isArray(data.facts) ? data.facts : [],
        body: data.body,
        context: data.context || '',
        imageCaption: data.imageCaption || '',
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`translation ${locale} rejected by all models (${lastErr?.message})`);
}
