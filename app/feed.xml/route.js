import { SITE } from '@/lib/config.mjs';
import { getIndex, localize } from '@/lib/content.mjs';

export const dynamic = 'force-static';

const esc = (s = '') => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

// GET /feed.xml?lang=de is not possible statically, so we ship the English feed.
export function GET() {
  const items = getIndex().slice(0, 50).map((a) => {
    const l = localize(a, 'en');
    return `<item><title>${esc(l.title)}</title><link>${SITE.url}/en/a/${a.slug}</link><guid>${SITE.url}/en/a/${a.slug}</guid><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate><category>${a.category}</category><description>${esc(l.dek)}</description></item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE.name}</title><link>${SITE.url}</link><description>News without noise.</description>${items.join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
