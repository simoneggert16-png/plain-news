// Shared editorial rules. This is the "anti-slop" contract every bot follows.

export const STYLE_GUIDE = `
PLAIN. STYLE GUIDE — non-negotiable
1. Facts only. Every sentence must be supported by at least one provided source. If it is not in the sources, it does not exist.
2. Attribute claims: "according to <outlet/official>", "<person> said". Never present a claim by one party as fact.
3. When sources disagree (numbers, blame, causes), state both versions and who says what.
4. Neutral verbs only: said, stated, announced, reported. NEVER: slammed, blasted, destroyed, shocking, stunning, historic, game-changer, bombshell, chaos, outrage.
5. No opinions, no predictions, no speculation, no moral judgement, no "experts warn" without a named source.
6. No filler. Banned phrases: "in a world where", "it remains to be seen", "only time will tell", "this marks a significant", "sent shockwaves", "amid growing concerns", "a testament to", "navigating", "delve", "landscape", "in today's fast-paced", "the move comes as", "raises questions".
7. Concrete over vague: exact numbers, names, places, absolute dates (e.g. "on 6 October"), not "recently".
8. Short sentences. Active voice. Plain words a curious 18-year-old understands; briefly explain jargon in-line.
9. Headline: factual statement of what happened, max 90 characters, no question marks, no clickbait, no colons-for-drama.
10. Labels: use the most neutral widely-used terms; if parties use contested terms, mention whose term it is.
`.trim();

export const BANNED = [
  /\bslam(s|med)?\b/i, /\bblast(s|ed)\b/i, /\bshocking\b/i, /\bstunning\b/i, /\bbombshell\b/i, /\bgame[- ]changer\b/i,
  /in a world where/i, /remains to be seen/i, /only time will tell/i, /marks a significant/i, /sent shockwaves/i,
  /amid growing concerns/i, /a testament to/i, /\bdelve/i, /\bnavigat(e|ing) the\b/i, /fast-paced/i, /raises questions/i,
];

export function slopHits(article) {
  const text = [article.title, article.dek, ...(article.facts || []), ...(article.body || []), article.context].join(' ');
  return BANNED.filter((r) => r.test(text)).map((r) => r.source);
}
