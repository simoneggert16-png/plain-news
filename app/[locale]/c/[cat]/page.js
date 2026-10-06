import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, CATEGORIES, isCategory } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import { listFor, localize } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';
import LiveTickerView from '@/components/LiveTickerView';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALE_CODES.flatMap((locale) => CATEGORIES.map((cat) => ({ locale, cat })));
}

export async function generateMetadata({ params }) {
  const { locale, cat } = await params;
  return { title: getDict(locale).cat[cat] };
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
              ? 'Live-Ergebnisse, Länderspiele und redaktionelle Spielberichte aus Champions League, Nations League, Premier League und Bundesliga.'
              : 'Live match scores, international fixtures, and verified factual reporting across major leagues.'}
          </p>
        )}
      </div>

      {cat === 'sport' && (
        <section className="category-liveticker-section" style={{ marginBottom: '40px' }}>
          <LiveTickerView locale={locale} initialFilter="sport" />
        </section>
      )}

      {items.length > 0 && cat === 'sport' && (
        <div className="sec-head" style={{ marginTop: '30px' }}>
          <h2>{isDe ? 'SPIELBERICHTE & ANALYSEN' : 'REPORTS & ANALYSIS'}</h2>
        </div>
      )}

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
    </>
  );
}
