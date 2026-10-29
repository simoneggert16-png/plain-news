import { chatJSON } from './llm.mjs';
import { terminologyFor } from './terminology.mjs';
import { LOCALES } from '../../lib/config.mjs';

/** Translate one article (source-language fields) into `locale`. Validates structure. */
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
  const { data } = await chatJSON('translator', [
    {
      role: 'system',
      content: `You are a professional news translator. Translate into ${lang.label} (${lang.bcp47}) in the neutral register of a quality newspaper in that language. Keep meaning exact. Do not add or remove information. Keep names, numbers and quotes accurate; use the established local spelling of place and person names.${terminologyFor(locale)} Reply with JSON only, same keys and same array lengths.`,
    },
    { role: 'user', content: JSON.stringify(input) },
  ], { temperature: 0.2, maxTokens: 10000 });
  if (!data.title || !Array.isArray(data.body) || data.body.length === 0) {
    throw new Error(`translation ${locale} missing title or body`);
  }
  // A translation that is byte-identical to the source is not a translation.
  // Storing it would freeze English text into the target locale forever.
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  if (norm(data.title).toLowerCase() === norm(src.title).toLowerCase()) {
    throw new Error(`translation ${locale} returned the source title`);
  }
  if (norm(src.dek) && (!norm(data.dek) || norm(data.dek).toLowerCase() === norm(src.dek).toLowerCase())) {
    throw new Error(`translation ${locale} returned no usable dek`);
  }
  if (Array.isArray(src.facts) && src.facts.length && (!Array.isArray(data.facts) || data.facts.length !== src.facts.length)) {
    throw new Error(`translation ${locale} lost facts (${data.facts?.length ?? 0}/${src.facts.length})`);
  }
  return {
    title: data.title,
    dek: data.dek || '',
    facts: Array.isArray(data.facts) ? data.facts : [],
    body: data.body,
    context: data.context || '',
    imageCaption: data.imageCaption || '',
  };
}
