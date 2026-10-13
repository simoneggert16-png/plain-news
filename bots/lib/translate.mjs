import { chatJSON } from './llm.mjs';
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
      content: `You are a professional news translator. Translate into ${lang.label} (${lang.bcp47}) in the neutral register of a quality newspaper in that language. Keep meaning exact. Do not add or remove information. Keep names, numbers and quotes accurate; use the established local spelling of place and person names. Reply with JSON only, same keys and same array lengths.`,
    },
    { role: 'user', content: JSON.stringify(input) },
  ], { temperature: 0.2, maxTokens: 10000 });
  if (!data.title || !Array.isArray(data.body) || data.body.length === 0) {
    throw new Error(`translation ${locale} missing title or body`);
  }
  return {
    title: data.title,
    dek: data.dek || src.dek,
    facts: Array.isArray(data.facts) && data.facts.length > 0 ? data.facts : src.facts,
    body: data.body,
    context: data.context || '',
    imageCaption: data.imageCaption || src.imageCaption || '',
  };
}
