// The repository as a runtime source for the content.
//
// Why: the deployment carries a snapshot of content/, but a build can ship a
// stale one - Vercel restores the files of the last build from its build
// cache, so a story that was published an hour ago is missing from the
// bundle. Git is the source of truth, and raw.githubusercontent.com serves it
// from a CDN. Reading it at runtime means a published story is online within
// a minute, without waiting for the next deployment - and the newsroom stops
// spending its daily deployment budget on content.
//
// The mirror (Supabase) stays the first choice: it is a database query and
// the site is built around it. This is the layer that answers when the mirror
// is unreachable or too slow.
import { sharedFetch, withDeadline } from './cache.mjs';

const REPO = process.env.CONTENT_REPO || 'simoneggert16-png/plain-news';
const BRANCH = process.env.CONTENT_BRANCH || 'main';
const BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const TIMEOUT_MS = Number(process.env.CONTENT_GIT_TIMEOUT_MS || 5000);
// The head of the index changes with every publication; an article file
// hardly ever does.
const HEAD_TTL_S = Math.max(30, Number(process.env.CONTENT_GIT_HEAD_TTL_S || 120));
const ARTICLE_TTL_S = Math.max(60, Number(process.env.CONTENT_GIT_ARTICLE_TTL_S || 300));

export const gitReadEnabled = (process.env.CONTENT_SOURCE || '').toLowerCase() !== 'files';

async function fetchJSON(url, timeoutMs, { missingIsEmpty = false } = {}) {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'plain-news' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  // A file that is not in the repository yet is not an outage - it is an
  // answer. Only a real failure may trip the breaker.
  if (res.status === 404 && missingIsEmpty) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${url}`);
  return res.json();
}

/** The newest entries of the index, straight from the repository. */
export async function readGitLatest() {
  const data = await sharedFetch(
    'git-latest',
    () => fetchJSON(`${BASE}/content/latest.json`, TIMEOUT_MS, { missingIsEmpty: true }),
    { revalidate: HEAD_TTL_S }
  );
  const articles = Array.isArray(data?.articles) ? data.articles : null;
  return articles && articles.length ? articles : null;
}

/** One article, straight from the repository. */
export async function readGitArticle(slug) {
  if (!/^[a-z0-9-]+$/.test(String(slug || ''))) return null;
  const data = await sharedFetch(
    `git-article-${slug}`,
    () => fetchJSON(`${BASE}/content/articles/${slug}.json`, TIMEOUT_MS, { missingIsEmpty: true }),
    { revalidate: ARTICLE_TTL_S }
  );
  return data && data.slug ? data : null;
}

/** The listing head of the repository, with a deadline. */
export function readGitLatestFast(timeoutMs = TIMEOUT_MS) {
  return withDeadline(readGitLatest(), timeoutMs, 'repository head');
}

/** One article from the repository, with a deadline. */
export function readGitArticleFast(slug, timeoutMs = TIMEOUT_MS) {
  return withDeadline(readGitArticle(slug), timeoutMs, `article ${slug}`);
}
