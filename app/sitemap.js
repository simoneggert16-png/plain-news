import { SITE, LOCALE_CODES, CATEGORIES } from '@/lib/config.mjs';
import { getIndex } from '@/lib/content.mjs';
import { getLiveIndex } from '@/lib/liveStore.mjs';

const STATIC_PATHS = ['', '/about', '/markets', '/ticker', '/live', '/longreads', '/investigations', '/sources', '/search', '/legal', '/privacy'];

const alternatesFor = (path, base) =>
  Object.fromEntries(LOCALE_CODES.map((locale) => [locale, `${base}/${locale}${path}`]));

export default async function sitemap() {
  const base = SITE.url;
  const now = new Date();

  const staticPages = LOCALE_CODES.flatMap((locale) =>
    STATIC_PATHS.map((path) => ({
      url: `${base}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? 'hourly' : 'weekly',
      priority: path === '' ? 1 : path === '/about' ? 0.7 : 0.5,
      alternates: { languages: alternatesFor(path, base) },
    }))
  );

  const categoryPages = LOCALE_CODES.flatMap((locale) =>
    CATEGORIES.map((cat) => ({
      url: `${base}/${locale}/c/${cat}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.7,
      alternates: { languages: alternatesFor(`/c/${cat}`, base) },
    }))
  );

  const articles = (await getIndex()).slice(0, 1000).flatMap((article) => {
    const lastModified = article.updatedAt || article.publishedAt;
    const languages = Object.fromEntries(
      LOCALE_CODES.map((locale) => [locale, `${base}/${locale}/a/${article.slug}`])
    );
    return LOCALE_CODES.map((locale) => ({
      url: `${base}/${locale}/a/${article.slug}`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
      alternates: { languages },
    }));
  });

  const livePages = getLiveIndex().flatMap((ticker) => {
    const lastModified = ticker.updatedAt || ticker.startedAt || now;
    const languages = Object.fromEntries(
      LOCALE_CODES.map((locale) => [locale, `${base}/${locale}/live/${ticker.slug}`])
    );
    return LOCALE_CODES.map((locale) => ({
      url: `${base}/${locale}/live/${ticker.slug}`,
      lastModified,
      changeFrequency: ticker.status === 'live' ? 'always' : 'daily',
      priority: ticker.status === 'live' ? 0.9 : 0.6,
      alternates: { languages },
    }));
  });

  return [...staticPages, ...categoryPages, ...articles, ...livePages];
}
