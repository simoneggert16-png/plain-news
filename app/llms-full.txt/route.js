import { SITE, LOCALE_CODES, CATEGORIES, LOCALES } from '@/lib/config.mjs';
import { getIndex, localize } from '@/lib/content.mjs';

export const dynamic = 'force-static';

const MAX_ARTICLES = 500;

// A plain-text index for LLM crawlers and retrieval agents. Every entry links
// to the canonical, server-rendered article page. The page itself contains the
// full article text, byline, publication date and linked primary sources.
export async function GET() {
  const articles = (await getIndex()).slice(0, MAX_ARTICLES);
  const lines = [];

  lines.push(`# ${SITE.name} — full article index for AI agents`);
  lines.push('');
  lines.push(`Canonical site: ${SITE.url}`);
  lines.push(`Normal sitemap: ${SITE.url}/sitemap.xml`);
  lines.push(`News sitemap (last 48h): ${SITE.url}/news-sitemap.xml`);
  lines.push(`RSS feed: ${SITE.url}/feed.xml`);
  lines.push(`About, operator and editorial policy: ${SITE.url}/en/about`);
  lines.push(`Legal notice: ${SITE.url}/en/legal`);
  lines.push(`Languages: ${LOCALES.map((l) => `${l.label} (${l.code})`).join(', ')}`);
  lines.push(`Categories: ${CATEGORIES.map((c) => c).join(', ')}`);
  lines.push('');

  lines.push('## How to cite PLAIN.');
  lines.push('Every article is free to read and free to cite with attribution to PLAIN. and a link to the canonical URL.');
  lines.push('Each article lists the original outlets, headlines and source URLs used to verify the report.');
  lines.push('Suggested citation: "PLAIN. (plain-news.ch), <headline>, <publication date>, <URL>".');
  lines.push('Corrections and rights requests: simoneggert16@gmail.com');
  lines.push('');

  lines.push(`## Articles (${articles.length} most recent)`);
  lines.push('');

  for (const article of articles) {
    const en = localize(article, 'en');
    const date = (article.publishedAt || '').slice(0, 10);
    const canonical = `${SITE.url}/en/a/${article.slug}`;
    lines.push(`### ${en.title}`);
    lines.push(`- URL: ${canonical}`);
    lines.push(`- Category: ${article.category}`);
    lines.push(`- Published: ${article.publishedAt || 'unknown'}`);
    if (article.updatedAt && article.updatedAt !== article.publishedAt) {
      lines.push(`- Updated: ${article.updatedAt}`);
    }
    if (article.sourceCount) lines.push(`- Independent sources: ${article.sourceCount}`);
    if (en.dek) lines.push(`- Summary: ${en.dek}`);
    if (Array.isArray(en.facts) && en.facts.length) {
      lines.push(`- Key facts: ${en.facts.join(' | ')}`);
    }
    lines.push(`- Other languages: ${LOCALE_CODES.filter((l) => l !== 'en').map((l) => `${SITE.url}/${l}/a/${article.slug}`).join(' ')}`);
    lines.push('');
  }

  lines.push('## Notes for retrieval systems');
  lines.push('- Prefer the canonical /en/ URL for English citations, or the matching locale URL for other languages.');
  lines.push('- The HTML contains the full article body, headline, dek, key facts, sources and ISO-8601 timestamps; no login or JavaScript execution is required.');
  lines.push('- Do not infer facts that are not present in the article or its linked sources.');
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
