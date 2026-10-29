import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import { liveLocalize, liveLastAt, liveUpdates } from '@/lib/live.mjs';
import { getLiveTicker } from '@/lib/liveStore.mjs';
import { getArticle } from '@/lib/content.mjs';
import LiveTicker from '@/components/LiveTicker';

// A ticker changes every few minutes, so this route must never be cached at
// build time. It also has to work before the bot's next deploy.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const ticker = await getLiveTicker(slug);
  if (!ticker) return {};
  const l = liveLocalize(ticker, locale);
  const t = getDict(locale);
  const url = `${SITE.url}/${locale}/live/${slug}`;
  return {
    title: `${l.title} · ${t.live.nav}`,
    description: l.dek || t.live.auto,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/live/${slug}`])),
        'x-default': `${SITE.url}/en/live/${slug}`,
      },
    },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: {
      title: l.title,
      description: l.dek || t.live.auto,
      url,
      siteName: SITE.name,
      type: 'article',
      publishedTime: ticker.startedAt,
      modifiedTime: liveLastAt(ticker) || ticker.startedAt,
    },
    twitter: { card: 'summary', title: l.title, description: l.dek || t.live.auto },
  };
}

export default async function LiveTickerPage({ params }) {
  const { locale, slug } = await params;
  const ticker = await getLiveTicker(slug);
  if (!ticker) notFound();

  const t = getDict(locale);
  const l = liveLocalize(ticker, locale);
  const bcp = LOCALES.find((x) => x.code === locale)?.bcp47 || 'de_CH';
  const url = `${SITE.url}/${locale}/live/${slug}`;
  const updates = liveUpdates(ticker);
  const modified = liveLastAt(ticker) || ticker.startedAt;

  // A ticker can be open before its article exists (or after an article was
  // dropped); the "read the whole article" link must not point into a 404.
  const linkedArticle = ticker.articleSlug ? await getArticle(ticker.articleSlug) : null;
  const displayTicker = linkedArticle ? ticker : { ...ticker, articleSlug: null };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LiveBlogPosting',
        '@id': `${url}#liveblog`,
        isPartOf: { '@id': `${SITE.url}/#website` },
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        headline: l.title,
        description: l.dek,
        inLanguage: bcp,
        datePublished: ticker.startedAt,
        dateModified: modified,
        coverageStartTime: ticker.startedAt,
        ...(ticker.endedAt ? { coverageEndTime: ticker.endedAt } : {}),
        isAccessibleForFree: true,
        author: { '@type': 'Organization', name: 'PLAIN. Editorial Desk', url: `${SITE.url}/${locale}/about` },
        publisher: {
          '@type': 'NewsMediaOrganization',
          '@id': `${SITE.url}/#organization`,
          name: SITE.name,
          url: SITE.url,
          logo: { '@type': 'ImageObject', url: `${SITE.url}/app-icon-1024.png`, width: 1024, height: 1024 },
        },
        about: { '@type': 'Event', name: ticker.topic || l.title },
        liveBlogUpdate: updates.slice(0, 50).map((u) => {
          const localized = u.locales?.[locale] || u.locales?.en || {};
          return {
            '@type': 'BlogPosting',
            '@id': `${url}#${u.id}`,
            headline: localized.headline,
            articleBody: localized.body,
            datePublished: u.at,
            dateModified: u.at,
            url: `${url}#${u.id}`,
            author: { '@id': `${SITE.url}/#organization` },
            ...(u.sources?.length
              ? {
                  citation: u.sources.map((s) => ({
                    '@type': 'CreativeWork',
                    name: s.title,
                    url: s.url,
                    publisher: { '@type': 'Organization', name: s.outlet },
                  })),
                }
              : {}),
          };
        }),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE.name, item: `${SITE.url}/${locale}` },
          { '@type': 'ListItem', position: 2, name: t.live.nav, item: `${SITE.url}/${locale}/live` },
          { '@type': 'ListItem', position: 3, name: l.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className="live-page live-page-single">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LiveTicker ticker={displayTicker} locale={locale} />
    </div>
  );
}
