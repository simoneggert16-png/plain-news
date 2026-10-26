// Editorial ranking shared by the homepage and the ticker.
//
// `importance` used to be hardcoded to 1 in the writer schema, so the
// "most important story of the day" pick on the homepage degenerated into
// "newest story" - which is why a Brazilian election disappeared behind a
// gondola rescue within a few hours. Ranking now combines the desk's
// importance, an impact heuristic and freshness.

export const HIGH_IMPACT = /\b(elections?|referendums?|presidential|president|prime minister|chancellor|parliament|knesset|congress|senate|coup|ceasefire|invasion|nuclear|earthquake|tsunami|hurricane|pandemic|assassination|mass shooting|hostage|rate decision|central bank|market crash|war|wars|präsident\w*|kanzler\w*|\w*wahl|krieg\w*)\b/i;

// An actual vote/result, as opposed to any story that merely mentions a
// campaign ("Wahlkampf" is excluded on purpose).
const ELECTION_HEADLINE = /(election|stichwahl|präsidentschafts\w*|\w*wahl)\b/i;

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
  return ELECTION_HEADLINE.test(title) && !/wahlkampf/i.test(title);
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
