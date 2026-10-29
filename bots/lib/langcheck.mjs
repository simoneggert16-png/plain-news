// Cheap target-language check for translated text.
// Guards against a model that answers in English or in the wrong script.

const SCRIPTS = {
  zh: { chars: /[\u4e00-\u9fff]/g, min: 40, foreign: /[\u3040-\u30ff]/ },
  ja: { chars: /[\u3040-\u30ff]/g, min: 20, foreign: /[\uac00-\ud7af]/ },
  ko: { chars: /[\uac00-\ud7af]/g, min: 20, foreign: /[\u3040-\u30ff]/ },
};

// High-frequency function words. They separate "written in the target
// language" from "English with translated nouns" well enough to catch a
// model that skipped the translation.
const STOPWORDS = {
  en: ['the', 'and', 'of', 'to', 'in', 'is', 'that', 'with', 'for', 'on', 'was', 'were', 'has', 'have', 'will', 'from', 'by', 'as', 'at'],
  de: ['der', 'die', 'das', 'und', 'nicht', 'wird', 'werden', 'mit', 'sich', 'ist', 'sind', 'auch', 'auf', 'für', 'von', 'dem', 'den', 'des', 'im', 'bei', 'nach', 'über', 'wurden', 'haben', 'hat', 'dass'],
  fr: ['le', 'la', 'les', 'des', 'et', 'est', 'pas', 'qui', 'que', 'pour', 'dans', 'sur', 'avec', 'une', 'un', 'du', 'au', 'aux', 'sont', 'été', 'par', 'plus', 'mais', 'ont', 'ce'],
  es: ['el', 'la', 'los', 'las', 'y', 'es', 'no', 'que', 'para', 'con', 'una', 'un', 'del', 'por', 'más', 'pero', 'han', 'fue', 'son', 'al', 'su', 'sus', 'se', 'como'],
  it: ['il', 'la', 'le', 'gli', 'di', 'e', 'non', 'che', 'per', 'con', 'una', 'un', 'del', 'dei', 'sono', 'è', 'anche', 'dalla', 'delle', 'ha', 'hanno', 'nel', 'alla', 'si'],
  pt: ['o', 'a', 'os', 'as', 'e', 'não', 'que', 'para', 'com', 'uma', 'um', 'do', 'da', 'dos', 'das', 'é', 'são', 'foi', 'pelo', 'pela', 'mais', 'mas', 'ao', 'nos', 'se'],
};

function countWords(text, words) {
  const flat = ` ${String(text).toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ')} `;
  let n = 0;
  for (const w of words) {
    let i = flat.indexOf(` ${w} `);
    while (i !== -1) {
      n++;
      i = flat.indexOf(` ${w} `, i + w.length + 1);
    }
  }
  return n;
}

/** Returns null when the text looks like `locale`, otherwise a reason string. */
export function languageProblem(locale, text) {
  const body = String(text ?? '');
  if (!body.trim()) return 'empty text';

  const script = SCRIPTS[locale];
  if (script) {
    const hits = (body.match(script.chars) || []).length;
    if (hits < script.min) return `only ${hits} ${locale} script characters`;
    if (script.foreign.test(body)) return `mixed with another script`;
    return null;
  }

  const target = STOPWORDS[locale];
  if (!target) return null;
  const targetHits = countWords(body, target);
  const englishHits = countWords(body, STOPWORDS.en);
  if (targetHits < 5) return `only ${targetHits} ${locale} function words`;
  if (targetHits < englishHits * 2) return `too much English (${englishHits} English vs ${targetHits} ${locale} function words)`;
  return null;
}

/** True when a headline/short string is still the English source. */
export function looksUntranslated(locale, text, source) {
  const a = String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const b = String(source ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!a || !b) return true;
  return a === b;
}
