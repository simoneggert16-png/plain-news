import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, CATEGORIES, SITE, isCategory } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import { listFor, localize } from '@/lib/content.mjs';
import { fmtDate, sourceLabel } from '@/lib/format.mjs';
import SportsLiveSidebar from '@/components/SportsLiveSidebar';
import CommunitySubmitSection from '@/components/CommunitySubmitSection';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALE_CODES.flatMap((locale) => CATEGORIES.map((cat) => ({ locale, cat })));
}

export async function generateMetadata({ params }) {
  const { locale, cat } = await params;
  const t = getDict(locale);
  const catName = t.cat[cat] || cat;
  const pageUrl = `${SITE.url}/${locale}/c/${cat}`;
  return {
    title: catName,
    description: `${catName} — Factual, multi-source verified reporting on PLAIN.`,
    alternates: {
      canonical: pageUrl,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/c/${cat}`])),
        'x-default': `${SITE.url}/en/c/${cat}`,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title: `${catName} — ${SITE.name}`,
      description: `${catName} — Factual, multi-source verified reporting on PLAIN.`,
      url: pageUrl,
      siteName: SITE.name,
      type: 'website',
    },
  };
}

export default async function CategoryPage({ params }) {
  const { locale, cat } = await params;
  if (!isCategory(cat)) notFound();
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const items = await listFor({ category: cat, limit: 60, locale });
  const isDe = locale === 'de';
  const pageUrl = `${SITE.url}/${locale}/c/${cat}`;
  const catName = t.cat[cat] || cat;
  const categoryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: `${catName} — ${SITE.name}`,
    description: `${catName} — factual, multi-source verified reporting on PLAIN.`,
    inLanguage: bcp,
    isPartOf: { '@id': `${SITE.url}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.slice(0, 10).map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE.url}/${locale}/a/${article.slug}`,
        name: localize(article, locale).title,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }} />
      <div className="category-header-wrap">
        <h1 className="page-title">{t.cat[cat]}</h1>
        {cat === 'sport' && (
          <p className="category-sub">
            {isDe
              ? 'Redaktionelle Spielberichte und Analysen im Hauptfenster – Live-Ergebnisse aus den Top-Sportarten weltweit in der rechten Sidebar.'
              : 'Verified editorial reports and match analyses in the main feed – live coverage across global sports in the right wire.'}
          </p>
        )}
      </div>

      {cat === 'community' ? (
        <CommunitySubmitSection locale={locale} isDe={isDe} />
      ) : cat === 'sport' ? (
        <div className="sport-split-layout">
          {/* Main Feed: Editorial Stories & Reports */}
          <div className="sport-main-content">
            <div className="sec-head" style={{ marginTop: 0 }}>
              <h2>{isDe ? 'SPIELBERICHTE & ANALYSEN' : 'REPORTS & ANALYSIS'}</h2>
            </div>
            {items.length === 0 ? (
              <div className="empty">{t.empty}</div>
            ) : (
              <div className="list">
                {items.map((a) => {
                  const l = localize(a, locale);
                  return (
                    <Link key={a.slug} href={`/${locale}/a/${a.slug}`} className="row">
                      <span className="meta">{fmtDate(a.publishedAt, bcp)}<br />{sourceLabel(a, t)}</span>
                      <h3>{l.title}</h3>
                      <p>{l.dek}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar: Sticky Multi-Sport Live Ticker */}
          <aside className="sport-sidebar-wrapper">
            <SportsLiveSidebar locale={locale} />
          </aside>
        </div>
      ) : (
        items.length === 0 ? (
          <div className="empty">{t.empty}</div>
        ) : (
          <div className="list">
            {items.map((a) => {
              const l = localize(a, locale);
              return (
                <Link key={a.slug} href={`/${locale}/a/${a.slug}`} className="row">
                  <span className="meta">{fmtDate(a.publishedAt, bcp)}<br />{sourceLabel(a, t)}</span>
                  <h3>{l.title}</h3>
                  <p>{l.dek}</p>
                </Link>
              );
            })}
          </div>
        )
      )}
    </>
  );
}
