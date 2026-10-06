import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, CATEGORIES, SITE, isCategory } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import { listFor, localize } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';
import SportsLiveSidebar from '@/components/SportsLiveSidebar';

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
      languages: Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/c/${cat}`])),
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
  const items = listFor({ category: cat, limit: 60 });
  const isDe = locale === 'de';

  return (
    <>
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

      {cat === 'sport' ? (
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
                      <span className="meta">{fmtDate(a.publishedAt, bcp)}<br />{a.sourceCount} {t.sources}</span>
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
                  <span className="meta">{fmtDate(a.publishedAt, bcp)}<br />{a.sourceCount} {t.sources}</span>
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
