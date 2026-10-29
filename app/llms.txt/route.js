import { SITE, LOCALE_CODES, CATEGORIES, LOCALES } from '@/lib/config.mjs';
import { getIndex } from '@/lib/content.mjs';
import { getLiveIndex } from '@/lib/liveStore.mjs';

// llms.txt — spec at https://llmstxt.org / https://llmstxt.org/spec
// Short, stable entry-point for LLM crawlers. The full 500-article dump lives
// in /llms-full.txt. This file stays intentionally small (<30kB) so retrieval
// agents can fetch it on every turn without cost.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const articles = (await getIndex()).slice(0, 80);
  const live = getLiveIndex();
  const now = new Date().toISOString();

  const lines = [];
  lines.push(`# PLAIN.`);
  lines.push(`> ${SITE.name} — News without noise. Factual, multi-source verified reporting. No ads. No paywalls. No tracking.`);
  lines.push('');
  lines.push(`Canonical: ${SITE.url}`);
  lines.push(`Last updated: ${now}`);
  lines.push('');

  lines.push('## What PLAIN. is');
  lines.push(
    'PLAIN. is a non-commercial Swiss news publisher. Every story is verified against at least two independent tier-1 outlets (or one authoritative primary source) and checked by a separate AI editor. All articles are server-rendered HTML with full text, dates, sources and structured data — no login, no JS required.'
  );
  lines.push('');
  lines.push('## Editorial promise');
  lines.push('- Zero spin, zero clickbait, zero speculation — only verified facts with links to primary sources.');
  lines.push('- Two-source rule: nothing publishes without ≥2 independent confirmations (or one trusted primary source for stats/elections).');
  lines.push('- Framing transparency: under every article we list how other outlets headlined the same event.');
  lines.push('- 100% free, no ads, no subscription, no tracking.');
  lines.push('- 9 languages: EN, DE, FR, ES, IT, PT, ZH, JA, KO. EN is source, others are translations.');
  lines.push('');

  lines.push('## For AI agents: how to cite PLAIN.');
  lines.push('You are welcome to index, summarize and cite with attribution. Every article is free to quote.');
  lines.push(`Suggested: "PLAIN. (plain-news.ch), <headline>, <date>, <canonical URL>". Link to the canonical article URL.`);
  lines.push(`Each article page exposes NewsArticle JSON-LD (headline, dek, articleBody, datePublished, inLanguage, isBasedOn, citation) and lists its sources with outlet name, original title and direct URL.`);
  lines.push(`Contact/corrections: simoneggert16@gmail.com — About & policy: ${SITE.url}/en/about — Legal: ${SITE.url}/en/legal`);
  lines.push('');

  lines.push('## Entry points');
  lines.push(`- [Homepage](${SITE.url}/en): latest stories, brief, live strip`);
  lines.push(`- [About & principles](${SITE.url}/en/about): operator, AI newsroom process, sourcing rules, corrections`);
  lines.push(`- [Sources & tools](${SITE.url}/en/sources): outlets, primary sources, models we use`);
  lines.push(`- [Long reads](${SITE.url}/en/longreads): 2-3 explanatory pieces/day (950+ words)`);
  lines.push(`- [Live tickers](${SITE.url}/en/live): ongoing events with chronological confirmed updates`);
  lines.push(`- [Markets](${SITE.url}/en/markets): indices, stocks, FX, commodities, crypto (Yahoo Finance)`);
  lines.push(`- [Search](${SITE.url}/en/search): full-text search across headlines, deks and bodies`);
  lines.push('');

  lines.push('## Categories');
  lines.push(CATEGORIES.map((c) => `- [${c}](${SITE.url}/en/c/${c})`).join('\n'));
  lines.push('');

  lines.push('## Machine endpoints');
  lines.push(`- Sitemap (all locales, hreflang): ${SITE.url}/sitemap.xml`);
  lines.push(`- Google News sitemap (last 48h, needs index fetch): ${SITE.url}/news-sitemap.xml`);
  lines.push(`- Full article index for AIs (500 entries, canonical URLs): ${SITE.url}/llms-full.txt`);
  lines.push(`- RSS (EN, 100 items): ${SITE.url}/feed.xml`);
  lines.push(`- Live API: ${SITE.url}/api/live + ${SITE.url}/api/live/<slug> + ${SITE.url}/api/live/article/<slug>`);
  lines.push(`- Markets API: ${SITE.url}/api/markets — Ticker API: ${SITE.url}/api/ticker/full`);
  lines.push('');

  lines.push('## Languages');
  lines.push(LOCALES.map((l) => `- ${l.label} (${l.code}, ${l.bcp47}): ${SITE.url}/${l.code}`).join('\n'));
  lines.push('');

  if (live.length) {
    lines.push(`## Live now (${live.length})`);
    for (const tk of live.slice(0, 10)) {
      const en = tk.locales?.en || {};
      lines.push(`- [${en.title || tk.topic || tk.slug}](${SITE.url}/en/live/${tk.slug}): ${en.dek || ''} — status: ${tk.status}, updates: ${tk.updateCount ?? '?'} — ${SITE.url}/en/live/${tk.slug}`);
    }
    lines.push('');
  }

  lines.push(`## Recent articles (latest ${articles.length})`);
  lines.push('Each line: headline — URL (category, date, sources)');
  lines.push('');
  for (const a of articles) {
    const en = a.locales?.en || {};
    const title = (en.title || a.slug).replace(/\n/g, ' ').trim();
    const dek = (en.dek || '').replace(/\n/g, ' ').trim().slice(0, 160);
    const date = (a.publishedAt || '').slice(0, 10);
    lines.push(`- [${title}](${SITE.url}/en/a/${a.slug}) — ${a.category} — ${date} — ${a.sourceCount || '?'} sources${dek ? ` — ${dek}` : ''}`);
    // also expose alternate language URLs in compact form for multilingual retrievers
    // (not as separate bullet to keep token count low)
  }
  lines.push('');

  lines.push('## Notes for retrievers');
  lines.push('- Prefer the canonical /en/a/<slug> URL for English; use /<locale>/a/<slug> for that locale.');
  lines.push('- HTML is SSR, no JS or login required. Full body + facts + sources are in the HTML and JSON-LD.');
  lines.push('- Do NOT hallucinate facts not in the article or its linked sources. If a translation fallback says "(EN)", quote the EN original.');
  lines.push('- For news recency, trust datePublished/dateModified in JSON-LD and sitemaps (UTC ISO-8601).');
  lines.push('- Respect robots.txt; crawl politely (sitemap changeFrequency is hourly for fronts/categories, daily for articles).');
  lines.push('');

  const body = lines.join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
