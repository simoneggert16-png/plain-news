import { SITE, LOCALES, SOURCE_LOCALE } from '@/lib/config.mjs';
import { createNewsIndexResponse } from '@/lib/news-sitemap.mjs';
import { getIndex } from '@/lib/content.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sitemap INDEX only: Google News allows max 1,000 URLs per news sitemap file,
// the site exceeded that (1,395 URLs) with nine languages, which invalidated
// the whole file. Children live at /news-sitemap/<n>.xml (max 1,000 URLs each).
export async function GET() {
  return createNewsIndexResponse(await getIndex(), {
    site: SITE, locales: LOCALES, sourceLocale: SOURCE_LOCALE, now: Date.now(),
  });
}
