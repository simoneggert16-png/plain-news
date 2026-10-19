import { SITE, LOCALE_CODES, CATEGORIES } from '@/lib/config.mjs';
import { getIndex } from '@/lib/content.mjs';

const STATIC_PATHS = ['', '/about', '/markets', '/ticker', '/search', '/legal', '/privacy'];

const alternatesFor = (path, base) =>
  Object.fromEntries(LOCALE_CODES.map((locale) => [locale, `${base}/${locale}${path}`]));

export default function sitemap() {
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

  const articles = getIndex().slice(0, 1000).flatMap((article) => {
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

  return [...staticPages, ...categoryPages, ...articles];
}
