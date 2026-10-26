import { SITE, LOCALES, SOURCE_LOCALE } from '@/lib/config.mjs';
import { createNewsIndexResponse, readNewsArticles } from '@/lib/news-sitemap.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return createNewsIndexResponse(readNewsArticles(), {
    site: SITE, locales: LOCALES, sourceLocale: SOURCE_LOCALE, now: Date.now(),
  });
}
