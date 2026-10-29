// Established political terms per target language.
//
// Small models translate "US midterm elections" literally ("Mittlere Wahlen",
// "mittlere Wahlen"), which reads like "medium-sized elections" to a German
// reader and landed on the front page. Terms are fixed here instead of being
// left to each model's instincts.
const BY_LOCALE = {
  de: 'Use established German political vocabulary: US "midterm elections" = "Zwischenwahlen" (never "Mittlere Wahlen", "Mittlere Wahl" or any literal rendering); "government shutdown" = "Regierungsstillstand"; "primaries" = "Vorwahlen"; "attorney general" = "Generalstaatsanwalt"; "Speaker of the House" = "Präsident des Repräsentantenhauses"; "ballot" = "Stimmzettel".',
  fr: 'Use established French political vocabulary: US "midterm elections" = "élections de mi-mandat".',
  es: 'Use established Spanish political vocabulary: US "midterm elections" = "elecciones de mitad de mandato".',
  it: 'Use established Italian political vocabulary: US "midterm elections" = "elezioni di metà mandato".',
  pt: 'Use established Portuguese political vocabulary: US "midterm elections" = "eleições de meio de mandato".',
};

/** Extra instruction for the translation prompt, empty when nothing is known. */
export const terminologyFor = (locale) => (BY_LOCALE[locale] ? ` ${BY_LOCALE[locale]}` : '');

// Wrong renderings that show a model ignored the glossary. Only German is
// enforced: the other languages have acceptable regional variants, so a hard
// gate there would throw away fine translations.
const FORBIDDEN = {
  de: { source: /midterm/i, reject: /Mittlere[nr]? Wahlen?|Midterm-?Wahlen?|Halbzeitwahlen/i, require: /Zwischenwahlen/i },
};

/** Reasons the translation ignored the glossary; empty when it is fine. */
export function terminologyProblems(locale, sourceText, translatedText) {
  const rule = FORBIDDEN[locale];
  if (!rule || !rule.source.test(String(sourceText))) return [];
  const out = String(translatedText);
  if (rule.reject.test(out)) return [`literal midterm rendering: ${out.match(rule.reject)[0]}`];
  if (!rule.require.test(out)) return ['midterm elections not rendered as "Zwischenwahlen"'];
  return [];
}
