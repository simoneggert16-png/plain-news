#!/usr/bin/env node
// Checks the deployed site the way search and AI crawlers see it.
// Usage:
//   node scripts/check_ai_visibility.mjs
//   SITE_URL=https://preview.example.com node scripts/check_ai_visibility.mjs
//   CHECK_UA=PerplexityBot/1.0 node scripts/check_ai_visibility.mjs
import { readFileSync } from 'node:fs';

const base = (process.env.SITE_URL || 'https://www.plain-news.ch').replace(/\/+$/, '');
const userAgent = process.env.CHECK_UA || 'OAI-SearchBot/1.0';
const timeoutMs = +(process.env.CHECK_TIMEOUT_MS || 25_000);

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: response.status, text: await response.text() };
};

const localRecentArticle = () => {
  try {
    const index = JSON.parse(readFileSync('content/index.json', 'utf8'));
    const articles = index.articles || [];
    return [...articles].sort(
      (a, b) => new Date(b.publishedAt || b.date) - new Date(a.publishedAt || a.date)
    )[0] || null;
  } catch {
    // The script can still check the static endpoints without a local index.
    return null;
  }
};

// Check an article that is actually deployed. The newest local article can be
// missing in production while a deploy is pending, which produces false alarms.
const deployedRecentArticle = async () => {
  try {
    const { status, text } = await fetchText(`${base}/sitemap.xml`);
    if (status !== 200) return null;
    const entries = [...text.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
    const articles = entries
      .map((entry) => {
        const loc = entry.match(/<loc>(.*?)<\/loc>/)?.[1] || '';
        const lastmod = entry.match(/<lastmod>(.*?)<\/lastmod>/)?.[1] || '';
        return { loc, lastmod };
      })
      .filter((entry) => /\/en\/a\//.test(entry.loc))
      .sort((a, b) => new Date(b.lastmod) - new Date(a.lastmod));
    if (!articles.length) return null;
    const slug = articles[0].loc.split('/en/a/')[1];
    return { slug, publishedAt: articles[0].lastmod };
  } catch {
    return null;
  }
};

const recentArticle = (await deployedRecentArticle()) || localRecentArticle();

const targets = [
  { name: 'robots.txt', url: `${base}/robots.txt`, type: 'text' },
  { name: 'sitemap.xml', url: `${base}/sitemap.xml`, type: 'xml' },
  { name: 'news-sitemap.xml', url: `${base}/news-sitemap.xml`, type: 'xml' },
  { name: 'llms.txt', url: `${base}/llms.txt`, type: 'text' },
  { name: 'llms-full.txt', url: `${base}/llms-full.txt`, type: 'text' },
  { name: 'home', url: `${base}/en`, type: 'html' },
  { name: 'category', url: `${base}/en/c/world`, type: 'html' },
  ...(recentArticle
    ? [{ name: `article: ${recentArticle.slug}`, url: `${base}/en/a/${recentArticle.slug}`, type: 'article', article: recentArticle }]
    : []),
];

const results = [];

for (const target of targets) {
  const issues = [];
  const warnings = [];
  let status = 0;
  let headers = new Headers();
  let body = '';

  try {
    const response = await fetch(target.url, {
      headers: { 'User-Agent': userAgent, Accept: '*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    status = response.status;
    headers = response.headers;
    body = await response.text();
  } catch (error) {
    issues.push(`request failed: ${error.message}`);
  }

  if (status && status !== 200) issues.push(`HTTP ${status}`);

  const robotsTag = headers.get('x-robots-tag') || '';
  if (/noindex/i.test(robotsTag)) issues.push(`X-Robots-Tag says noindex: ${robotsTag}`);

  if (target.type === 'html' || target.type === 'article') {
    if (!/<html[\s>]/i.test(body)) issues.push('no HTML document returned');
    if (!/<title[^>]*>\s*\S/i.test(body)) issues.push('missing <title>');
    if (!/<h1[\s>]/i.test(body)) issues.push('missing <h1>');
    if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(body)) {
      issues.push('page meta robots says noindex');
    }
    if (target.type === 'article') {
      if (!/NewsArticle/.test(body)) issues.push('missing NewsArticle JSON-LD');
      if (!body.includes(target.article.slug)) issues.push('article slug not present in HTML');
      const title = target.article.locales?.en?.title || target.article.title || '';
      if (title) {
        if (!body.includes(title.slice(0, 40))) issues.push('article headline not present in HTML');
      } else if (!/"headline"\s*:/.test(body)) {
        issues.push('missing headline in NewsArticle JSON-LD');
      }
      if (!/datePublished/.test(body)) issues.push('missing datePublished');
    }
  }

  if (target.name === 'robots.txt') {
    for (const token of ['OAI-SearchBot', 'GPTBot', 'PerplexityBot', 'ClaudeBot', 'Googlebot', 'Sitemap:']) {
      if (!body.includes(token)) issues.push(`robots.txt missing ${token}`);
    }
    if (!body.includes('news-sitemap.xml')) issues.push('robots.txt does not reference news-sitemap.xml');
  }

  if (target.name === 'sitemap.xml' && !/<urlset[\s>]/i.test(body)) issues.push('not a urlset sitemap');
  if (target.name === 'news-sitemap.xml' && !/<news:news[\s>]/i.test(body)) {
    warnings.push('no <news:news> entries yet (normal if no article was published in the last 48h)');
  }
  if (target.name === 'llms.txt' && !/# PLAIN/i.test(body)) issues.push('unexpected llms.txt content');
  if (target.name === 'llms-full.txt' && !/## Articles/i.test(body)) issues.push('unexpected llms-full.txt content');

  results.push({ target, status, issues, warnings, bytes: body.length });
}

const pad = (value, width) => String(value).padEnd(width);
console.log(`\nPLAIN AI visibility check — ${base}`);
console.log(`User-Agent: ${userAgent}\n`);
console.log(`${pad('CHECK', 34)} ${pad('STATUS', 7)} ${pad('BYTES', 9)} RESULT`);
console.log('-'.repeat(78));
for (const { target, status, issues, warnings, bytes } of results) {
  const state = issues.length ? 'FAIL' : warnings.length ? 'WARN' : 'OK';
  console.log(`${pad(target.name, 34)} ${pad(status || 'ERR', 7)} ${pad(bytes, 9)} ${state}`);
  for (const issue of issues) console.log(`  - ${issue}`);
  for (const warning of warnings) console.log(`  - warning: ${warning}`);
}

const failures = results.filter((result) => result.issues.length);
const warnings = results.filter((result) => result.warnings.length);
console.log(`\n${results.length - failures.length}/${results.length} checks passed${warnings.length ? `, ${warnings.length} warning(s)` : ''}.`);
if (failures.length) {
  console.log('\nIf a check fails only from this machine, verify the production firewall/CDN allows the User-Agent and OpenAI\'s published IP ranges.');
  process.exitCode = 1;
}
