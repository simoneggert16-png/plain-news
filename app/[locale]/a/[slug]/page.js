import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { getArticle, getIndex, localize, readingMinutes } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';

export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = getIndex().map((a) => a.slug);
  return LOCALE_CODES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  const l = localize(a, locale);
  return {
    title: l.title,
    description: l.dek,
    alternates: { languages: Object.fromEntries(LOCALE_CODES.map((c) => [c, `/${c}/a/${slug}`])) },
    openGraph: { title: l.title, description: l.dek, type: 'article', publishedTime: a.publishedAt, siteName: SITE.name },
  };
}

export default async function ArticlePage({ params }) {
  const { locale, slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const l = localize(a, locale);
  const outlets = new Set(a.sources.map((s) => s.outlet)).size;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: l.title,
    description: l.dek,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt || a.publishedAt,
    inLanguage: bcp,
    isBasedOn: a.sources.map((s) => s.url),
    publisher: { '@type': 'Organization', name: SITE.name },
  };

  return (
    <article className="article">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="art-head">
        <Link href={`/${locale}/c/${a.category}`} className="label label-inv">{t.cat[a.category]}</Link>
        <h1>{l.title}</h1>
        <p className="dek">{l.dek}</p>
        <div className="art-meta meta">
          <span>{fmtDate(a.publishedAt, bcp, { year: 'numeric' })}</span>
          {a.updatedAt && a.updatedAt !== a.publishedAt && <span>{t.updated} {fmtDate(a.updatedAt, bcp)}</span>}
          <span>{fmt(t.minRead, { n: readingMinutes(a, locale) })}</span>
          <span>{outlets} {t.sources}</span>
        </div>
      </header>

      {l.isFallback && <div className="notice">EN</div>}

      {l.facts?.length > 0 && (
        <section className="facts">
          <h2>{t.keyFacts}</h2>
          <ul>{l.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </section>
      )}

      <div className="body">
        {(l.body || []).map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {l.context && (
        <section className="art-section">
          <h2>{t.context}</h2>
          <p>{l.context}</p>
        </section>
      )}

      <section className="art-section">
        <h2>{t.framing}</h2>
        <ul className="framing">
          {a.sources.map((s, i) => (
            <li key={i}>
              <span className="outlet">{s.outlet}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title} ↗</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="art-section">
        <h2>{t.howMade}</h2>
        <p className="howmade">{fmt(t.howMadeText, { n: outlets })}</p>
      </section>
    </article>
  );
}
