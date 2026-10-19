import { SITE, LOCALE_CODES, LOCALES } from '@/lib/config.mjs';
import { getIndex, localize } from '@/lib/content.mjs';

export const dynamic = 'force-static';

const esc = (s = '') =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

// Google News sitemaps may only contain articles from the last two days.
// Older stories stay in /sitemap.xml.
const NEWS_WINDOW_MS = 48 * 3600 * 1000;

export function GET() {
  const cutoff = Date.now() - NEWS_WINDOW_MS;
  const articles = getIndex()
    .filter((article) => {
      const published = Date.parse(article.publishedAt || '');
      return Number.isFinite(published) && published >= cutoff;
    })
    .slice(0, 1000);

  const urls = articles.flatMap((article) =>
    LOCALE_CODES.map((locale) => {
      const bcp47 = LOCALES.find((l) => l.code === locale)?.bcp47 || locale;
      const localized = localize(article, locale);
      return [
        '<url>',
        `<loc>${esc(`${SITE.url}/${locale}/a/${article.slug}`)}</loc>`,
        '<news:news>',
        '<news:publication>',
        `<news:name>${esc(SITE.name)}</news:name>`,
        `<news:language>${esc(bcp47.split('-')[0])}</news:language>`,
        '</news:publication>',
        `<news:publication_date>${esc(article.publishedAt)}</news:publication_date>`,
        `<news:title>${esc(localized.title)}</news:title>`,
        '</news:news>',
        '</url>',
      ].join('');
    })
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    urls.join(''),
    '</urlset>',
  ].join('');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
