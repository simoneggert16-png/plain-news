import Link from 'next/link';
import { LOCALES, LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { getIndex, localize } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const pageUrl = `${SITE.url}/${locale}/longreads`;
  return {
    title: t.longreads.title,
    description: t.longreads.intro,
    alternates: {
      canonical: pageUrl,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/longreads`])),
        'x-default': `${SITE.url}/en/longreads`,
      },
    },
    openGraph: {
      title: `${t.longreads.title} — ${SITE.name}`,
      description: t.longreads.intro,
      url: pageUrl,
      siteName: SITE.name,
      type: 'website',
    },
  };
}

export default async function LongreadsPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const pageUrl = `${SITE.url}/${locale}/longreads`;

  // Long reads are the pieces the newsroom gave room to. Everything else is a
  // report; this page is deliberately only the slow stuff.
  const items = (await getIndex()).filter((a) => a.form === 'longform').slice(0, 60);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: `${t.longreads.title} — ${SITE.name}`,
    description: t.longreads.intro,
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
        <p className="lr-kicker">{t.longreads.kicker}</p>
        <h1 className="page-title">{t.longreads.title}</h1>
        <p className="lr-intro">{t.longreads.intro}</p>
      </header>

      {items.length === 0 ? (
        <div className="empty">{t.longreads.empty}</div>
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
                  <h2 className="lr-item-title">{l.title}</h2>
                  {l.dek && <p className="lr-item-dek">{l.dek}</p>}
                  {l.standfirst && <p className="lr-item-standfirst">{l.standfirst}</p>}
                  <span className="lr-item-more">{t.longreads.open} →</span>
                </Link>
              </article>
            );
          })}
        </div>
      )}

      <p className="lr-note">{t.footer}</p>
    </>
  );
}
