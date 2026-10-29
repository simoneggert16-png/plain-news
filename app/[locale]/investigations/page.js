import Link from 'next/link';
import { LOCALES, LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { getIndex, localize } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';
import InvestigationRequestForm from '@/components/InvestigationRequestForm';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const pageUrl = `${SITE.url}/${locale}/investigations`;
  return {
    title: t.investigations.title,
    description: t.investigations.intro,
    alternates: {
      canonical: pageUrl,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/investigations`])),
        'x-default': `${SITE.url}/en/investigations`,
      },
    },
    openGraph: {
      title: `${t.investigations.title} — ${SITE.name}`,
      description: t.investigations.intro,
      url: pageUrl,
      siteName: SITE.name,
      type: 'website',
    },
  };
}

export default async function InvestigationsPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const pageUrl = `${SITE.url}/${locale}/investigations`;

  const items = (await getIndex()).filter((a) => a.form === 'investigation').slice(0, 40);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: `${t.investigations.title} — ${SITE.name}`,
    description: t.investigations.intro,
    inLanguage: bcp,
    isPartOf: { '@id': `${SITE.url}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.slice(0, 20).map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE.url}/${locale}/a/${a.slug}`,
        name: localize(a, locale).title,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="lr-head">
        <p className="lr-kicker">{t.investigations.kicker}</p>
        <h1 className="page-title">{t.investigations.title}</h1>
        <p className="lr-intro">{t.investigations.intro}</p>
      </header>

      <section className="inv-published">
        <h2 className="inv-section-label">{t.investigations.publishedTitle}</h2>
        {items.length === 0 ? (
          <div className="empty">{t.investigations.empty}</div>
        ) : (
          <div className="lr-list">
            {items.map((a) => {
              const l = localize(a, locale);
              const minutes = a.readingMinutes || 0;
              return (
                <article key={a.slug} className="lr-item">
                  <Link href={`/${locale}/a/${a.slug}`} className="lr-link">
                    <p className="lr-item-meta">
                      <span className="lr-item-cat">{t.cat[a.category] || a.category}</span>
                      <span>
                        <time dateTime={a.publishedAt}>{fmtDate(a.publishedAt, bcp, { year: 'numeric' })}</time>
                      </span>
                      {minutes > 0 && <span>{fmt(t.minRead, { n: minutes })}</span>}
                    </p>
                    <div>
                      <h3 className="lr-item-title">{l.title}</h3>
                      {l.dek && <p className="lr-item-dek">{l.dek}</p>}
                      {l.standfirst && <p className="lr-item-standfirst">{l.standfirst}</p>}
                      <span className="lr-item-more">{t.investigations.open} →</span>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="inv-layout">
        <section className="inv-how">
          <h2 className="inv-section-label">{t.investigations.howTitle}</h2>
          <ol className="inv-how-list">
            {t.investigations.how.map((line) => <li key={line}>{line}</li>)}
          </ol>
        </section>

        <InvestigationRequestForm locale={locale} t={t.investigations} />
      </div>

      <p className="lr-note">{t.footer}</p>
    </>
  );
}
