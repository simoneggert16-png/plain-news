import { SITE, LOCALE_CODES, CATEGORIES } from '@/lib/config.mjs';
import { getIndex } from '@/lib/content.mjs';

export default function sitemap() {
  const base = SITE.url;
  const pages = LOCALE_CODES.flatMap((l) => [
    { url: `${base}/${l}`, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/${l}/markets`, changeFrequency: 'always', priority: 0.6 },
    ...CATEGORIES.map((c) => ({ url: `${base}/${l}/c/${c}`, changeFrequency: 'hourly', priority: 0.7 })),
  ]);
  const articles = getIndex().slice(0, 500).flatMap((a) =>
    LOCALE_CODES.map((l) => ({ url: `${base}/${l}/a/${a.slug}`, lastModified: a.updatedAt || a.publishedAt, priority: 0.8 }))
  );
  return [...pages, ...articles];
}
