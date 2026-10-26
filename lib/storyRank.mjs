// Editorial ranking shared by the homepage and the ticker.
//
// `importance` used to be hardcoded to 1 in the writer schema, so the
// "most important story of the day" pick on the homepage degenerated into
// "newest story" - which is why a Brazilian election disappeared behind a
// gondola rescue within a few hours. Ranking now combines the desk's
// importance, an impact heuristic and freshness.

export const HIGH_IMPACT = /\b(elections?|referendums?|presidential|president|prime minister|chancellor|parliament|knesset|congress|senate|coup|ceasefire|invasion|nuclear|earthquake|tsunami|hurricane|pandemic|assassination|mass shooting|hostage|rate decision|central bank|market crash|war|wars|präsident\w*|kanzler\w*|\w*wahl|krieg\w*)\b/i;

// An actual vote or its outcome, as opposed to any story that merely happens
// "ahead of" a vote. Two conditions must hold: an election word AND an
// outcome/event word ("wins", "elected", "holds", "concedes", "Ergebnis").
// Campaign colour ("Wahlkampf", "vor der Wahl", "election gains", "ahead of
// the election") is explicitly disqualifying - that is what pushed a story
// about Spanish unions in front of the Brazilian and Serbian results.
const ELECTION_EVENT =
  /\belect(?:ed|ion|ions)\b|\b(?:stichwahl|rundwahl|run-?offs?|präsidentschaftswahl\w*|parlamentswahl\w*|wahl|wahlen)\b/i;
const ELECTION_OUTCOME =
  /\b(?:gewinnt|gewann|gewonnen|gewählt\w*|wählt\w*|siegt\w*|ergebnis\w*|auszählung\w*|hochrechnung\w*|prognose\w*|elected|elects|wins?|won|winning|concedes?|defeat\w*|declared|results?|holds?|hält|halten|voters?)\b/i;
const ELECTION_CAMPAIGN =
  /\b(?:wahlkampf\w*|campaign (?:stops?|trail|rall(?:y|ies)|season|mode)|ahead of|before|eve of|vor der|vor den|im vorfeld|vorab|debate\w*|predict\w*|prognostizier\w*|heats? up)\b/i;

// Stories that deserve to sit on top of a filter for the day: votes, war
// escalation, disasters. Generic "president"/"senate" politics is not enough.
export const TOP_STORY = /\b(elections?|stichwahl|präsidentschafts\w*|\w*wahl|referendum|ceasefire|invasion|earthquake|tsunami|hurricane|pandemic|coup|assassination|war|wars|krieg\w*)\b/i;

function titleOf(article) {
  const l = article?.locales || {};
  return [l.de?.title, l.en?.title, article?.title].filter(Boolean).join(' ');
}

function articleText(article) {
  const l = article?.locales || {};
  return [l.de?.title, l.en?.title, l.de?.dek, l.en?.dek, article?.title]
    .filter(Boolean)
    .join(' ');
}

export function isHighImpact(article) {
  return HIGH_IMPACT.test(articleText(article));
}

/** Same heuristic for a raw headline (ticker wire items). */
export function isHighImpactText(text = '') {
  return HIGH_IMPACT.test(text);
}

export function isTopStory(article) {
  return TOP_STORY.test(articleText(article));
}

export function isTopStoryText(text = '') {
  return TOP_STORY.test(text);
}

export function isElectionHeadline(article) {
  const title = titleOf(article);
  if (!title) return false;
  if (ELECTION_CAMPAIGN.test(title)) return false;
  return ELECTION_EVENT.test(title) && ELECTION_OUTCOME.test(title);
}

// Words that describe the genre rather than the subject. Two stories about
// "elections" are not the same story; two stories about Israel are.
const SUBJECT_STOP = new Set(
  `election elections wahl wahlen parliamentary parliament presidential president
   praesident präsident chancellor kanzler minister government regierung holds hold
   haelt hält wins win won gewinnt gewann gewaehlt gewählt voters voter results result
   ergebnis nach vor der den die das und mit fuer für from with that this after
   before amid over into says said will says according while during first second
   third round runoff stichwahl rundwahl polls poll vote votes stimmen
   facing faces ahead tensions über wird werden wurde haben hatte gegen mehr sich
   auch noch sein seine wenn dass ohne unter beim vom zum zur durch kommt sagte
   sagt sollen muss können nicht eine einen einem eines dieser diese dieses sowie
   aber dann jetzt schon immer wieder erneut erste ersten neuen neue plant plant
   droht warum wieviel zwischen wegen trotz weiter weitere mehrere`
    .split(/\s+/)
    .filter(Boolean)
);

function subjectTokens(article) {
  return new Set(
    titleOf(article)
      .toLowerCase()
      .normalize('NFC')
      .split(/[^0-9a-z\u00c0-\u024f]+/i)
      .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !SUBJECT_STOP.has(w))
  );
}

/**
 * True when two articles clearly cover the same topic (shared proper noun such
 * as a country, a person or a place). Used so the front page does not list the
 * same election twice - once as the lead and once in the brief.
 */
export function sharesSubject(a, b) {
  const tb = subjectTokens(b);
  if (!tb.size) return false;
  for (const t of subjectTokens(a)) if (tb.has(t)) return true;
  return false;
}

/**
 * Bigger is more newsworthy. Importance dominates, a real election counts as
 * importance 4 even in the legacy archive (where everything was stamped 1),
 * other high-impact topics get a bump, and freshness decays over ~30 hours.
 */
export function storyScore(article, now = Date.now()) {
  const ts = Date.parse(article?.publishedAt || '');
  const ageH = Number.isFinite(ts) ? Math.max(0, (now - ts) / 36e5) : 999;
  const stated = Math.min(5, Math.max(1, Number(article?.importance) || 1));
  const importance = Math.max(stated, isElectionHeadline(article) ? 4 : 0, isHighImpact(article) ? 2.5 : 0);
  const freshness = Math.max(0, 1 - ageH / 30);
  return importance * 10 + freshness * 8;
}

/** Rank a list without mutating it. */
export function rankArticles(articles, now = Date.now()) {
  return [...articles].sort((a, b) => storyScore(b, now) - storyScore(a, now));
}
