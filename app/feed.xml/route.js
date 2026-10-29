import { SITE } from '@/lib/config.mjs';
import { getIndex, localize } from '@/lib/content.mjs';

export const dynamic = 'force-static';

const esc = (s = '') => String(s).replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const cdata = (s = '') => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

// GET /feed.xml ships the English feed. Each item links to the canonical
// server-rendered article, which is available in all nine languages.
export async function GET() {
  const articles = (await getIndex()).slice(0, 100);
  const lastBuildDate = articles[0]?.publishedAt ? new Date(articles[0].publishedAt).toUTCString() : new Date().toUTCString();
  const FALLBACK_IMAGE = `${SITE.url}/app-icon-1024.png`;

  const items = articles.map((a) => {
    const l = localize(a, 'en');
    const url = `${SITE.url}/en/a/${a.slug}`;
    const bodyHtml = [
      l.dek ? `<p><strong>${esc(l.dek)}</strong></p>` : '',
      ...(l.facts || []).length ? [`<ul>${(l.facts || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`] : [],
      ...((l.body || []).map((p) => `<p>${esc(p)}</p>`)),
      l.context ? `<p><em>${esc(l.context)}</em></p>` : '',
      `<p>Sources: ${(a.sources || []).map((s) => `<a href="${esc(s.url)}">${esc(s.outlet)}: ${esc(s.title)}</a>`).join(' | ')}</p>`,
    ].join('');
    const imageUrl = a.image || FALLBACK_IMAGE;
    return [
      '<item>',
      `<title>${esc(l.title)}</title>`,
      `<link>${esc(url)}</link>`,
      `<guid isPermaLink="true">${esc(url)}</guid>`,
      `<pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>`,
      a.updatedAt && a.updatedAt !== a.publishedAt ? `<atom:updated>${new Date(a.updatedAt).toISOString()}</atom:updated>` : '',
      `<category>${esc(a.category)}</category>`,
      `<description>${esc(l.dek || l.title)}</description>`,
      `<content:encoded>${cdata(bodyHtml)}</content:encoded>`,
      `<enclosure url="${esc(imageUrl)}" type="image/${imageUrl.endsWith('.png') ? 'png' : 'jpeg'}" />`,
      `<media:content url="${esc(imageUrl)}" medium="image" />`,
      '<author>simoneggert16@gmail.com (PLAIN. Editorial Desk)</author>',
      `<source url="${esc(SITE.url)}/feed.xml">${esc(SITE.name)}</source>`,
      '</item>',
    ].join('');
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">',
    '<channel>',
    `<title>${esc(SITE.name)}</title>`,
    `<link>${esc(SITE.url)}</link>`,
    `<description>${esc('News without noise. Factual, multi-source verified reporting.')}</description>`,
    '<language>en</language>',
    `<copyright>${new Date().getFullYear()} ${esc(SITE.name)}</copyright>`,
    '<managingEditor>simoneggert16@gmail.com (PLAIN. Editorial Desk)</managingEditor>',
    '<webMaster>simoneggert16@gmail.com (PLAIN. Editorial Desk)</webMaster>',
    `<lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    '<ttl>60</ttl>',
    `<atom:link href="${esc(`${SITE.url}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    items.join(''),
    '</channel>',
    '</rss>',
  ].join('');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
