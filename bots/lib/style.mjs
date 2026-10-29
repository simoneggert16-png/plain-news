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
11. Rhythm. Vary sentence length: every paragraph needs at least one longer sentence with two clauses, and never four short declarative sentences in a row.
12. Every sentence adds information. Do not restate the previous sentence in other words, and never end a paragraph with an evaluative summary ("This was a test of…", "It showed…").
13. Open paragraphs with the actor, the number, the document or the date — not with the same noun that opened the previous paragraph.
14. No evaluative framing: no "a test of", "a sign of", "a reminder", "marked a turning point", "played a key role", "underlined", "sent a signal". Report what happened; the reader draws the conclusion.
15. Do not hide the speaker: "was described as tense" is banned unless you name who described it. Either attribute the judgement or drop it.
16. Concrete beats atmospheric: a vote count, a contract sum, a date, a document title — not "a tense day" or "a high turnout" without the figure.
`.trim();

export const BANNED = [
  /\bslam(s|med)?\b/i, /\bblast(s|ed)\b/i, /\bshocking\b/i, /\bstunning\b/i, /\bbombshell\b/i, /\bgame[- ]changer\b/i,
  /in a world where/i, /remains to be seen/i, /only time will tell/i, /marks a significant/i, /sent shockwaves/i,
  /amid growing concerns/i, /a testament to/i, /\bdelve/i, /\bnavigat(e|ing) the\b/i, /fast-paced/i, /raises questions/i,
  // Evaluative framing that reads as generated copy.
  /\bwas a test of\b/i, /\b(?:is|was) a reminder (?:that|of)\b/i, /\bserves? as a reminder\b/i,
  /\breflects? a broader\b/i, /\ba (?:pivotal|defining) moment\b/i, /\bmarked a turning point\b/i, /\bushered in\b/i,
  /\bplayed a (?:key|crucial|critical|significant|central) role\b/i, /\bhighlight(?:s|ed) the importance\b/i,
  /\bleft (?:many|the (?:country|region|world)) (?:reeling|asking|wondering)\b/i, /\bsignals? a shift\b/i,
  /\bcemented (?:his|her|its|the)\b/i, /\bin a (?:significant|major) (?:shift|move|development)\b/i,
  // German equivalents of the same stock phrases.
  /\bwar ein Test (?:für|der)\b/i, /\bunterstr(?:ich|eicht)\b/i, /\bverdeutlichte?\b/i,
  /\bspielte eine (?:entscheidende|wichtige|zentrale|bedeutende) Rolle\b/i, /\bim Zeichen von\b/i,
  /\bwarf ein Schlaglicht\b/i, /\bsorgte für Aufsehen\b/i, /\bmarkierte einen Wendepunkt\b/i,
  /\bgalt als (?:Test|Zeichen|Beweis)\b/i, /\bzeigte sich (?:erneut|deutlich|einmal mehr)\b/i,
  /\bein (?:deutliches|klares) (?:Signal|Zeichen)\b/i, /\bnicht weniger als\b/i,
];

const sentencesOf = (text) =>
  String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length > 2);

/**
 * Structural tics that no single banned phrase catches: the same sentence
 * opening over and over, four-word staccato paragraphs, and judgements hidden
 * behind passive voice. Returns human-readable problems for the editor prompt.
 */
export function styleProblems(block) {
  const paragraphs = (block?.sections || []).flatMap((s) => s.paragraphs || []);
  const problems = [];

  const openers = new Map();
  const lengths = [];
  for (const paragraph of paragraphs) {
    for (const sentence of sentencesOf(paragraph)) {
      const words = sentence.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
      lengths.push(words.length);
      if (words.length >= 2) {
        const key = words.slice(0, 2).join(' ');
        openers.set(key, (openers.get(key) || 0) + 1);
      }
    }
  }

  const repeated = [...openers.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (repeated.length) {
    problems.push(`repeated sentence openings: ${repeated.map(([key, n]) => `"${key}…" ×${n}`).join(', ')}`);
  }

  const short = lengths.filter((n) => n <= 12).length;
  if (lengths.length >= 20 && short / lengths.length > 0.62) {
    problems.push(`${Math.round((short / lengths.length) * 100)}% of sentences are 12 words or fewer — the text reads like a list, not prose`);
  }

  const paragraphsShort = paragraphs.filter((p) => {
    const parts = sentencesOf(p);
    return parts.length >= 3 && parts.length <= 4 && parts.every((s) => s.split(/\s+/).length <= 14);
  }).length;
  if (paragraphs.length >= 6 && paragraphsShort / paragraphs.length > 0.5) {
    problems.push(`${paragraphsShort} of ${paragraphs.length} paragraphs are 3-4 short declarative sentences — vary the rhythm`);
  }

  const text = paragraphs.join(' ');
  if (/\b(?:was|were) (?:described|seen|viewed|perceived) as\b/i.test(text) || /\bwurde[n]? (?:als|von) [^.]{0,60}(?:beschrieben|gesehen|gewertet)\b/i.test(text)) {
    problems.push('judgements hidden behind passive voice ("was described as") — name who said it or cut it');
  }

  return problems;
}

export function slopHits(article) {
  const text = [article.title, article.dek, ...(article.facts || []), ...(article.body || []), article.context].join(' ');
  return BANNED.filter((r) => r.test(text)).map((r) => r.source);
}
