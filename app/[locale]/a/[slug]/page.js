import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { getArticle, getIndex, localize, readingMinutes } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';
import VideoPlayer from '@/components/VideoPlayer';
import ArticleActions from '@/components/ArticleActions';
import ArticleComments from '@/components/ArticleComments';
import MatchCenterView from '@/components/MatchCenterView';

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
  const articleUrl = `${SITE.url}/${locale}/a/${slug}`;
  return {
    title: l.title,
    description: l.dek,
    alternates: {
      canonical: articleUrl,
      languages: Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/a/${slug}`])),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: l.title,
      description: l.dek,
      url: articleUrl,
      type: 'article',
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt || a.publishedAt,
      section: a.category,
      siteName: SITE.name,
      images: a.image ? [{ url: a.image, alt: l.imageCaption || l.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: l.title,
      description: l.dek,
      images: a.image ? [a.image] : [],
    },
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
  const articleUrl = `${SITE.url}/${locale}/a/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    headline: l.title,
    description: l.dek,
    articleSection: a.category,
    image: a.image ? [a.image] : undefined,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt || a.publishedAt,
    inLanguage: bcp,
    isBasedOn: a.sources.map((s) => s.url),
    author: {
      '@type': 'Organization',
      name: 'PLAIN. Editorial Wire',
      url: SITE.url,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE.url}/icon.svg`,
      },
    },
  };

  return (
    <article className="article">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="art-head">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <Link href={`/${locale}/c/${a.category}`} className="label label-inv">{t.cat[a.category]}</Link>
          {a.video && (
            <span className="badge-video">
              <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              VIDEO
            </span>
          )}
        </div>
        <h1>{l.title}</h1>
        <p className="dek">{l.dek}</p>
        <div className="art-meta meta">
          <span>{fmtDate(a.publishedAt, bcp, { year: 'numeric' })}</span>
          {a.updatedAt && a.updatedAt !== a.publishedAt && <span>{t.updated} {fmtDate(a.updatedAt, bcp)}</span>}
          <span>{fmt(t.minRead, { n: readingMinutes(a, locale) })}</span>
          <span>{outlets} {t.sources}</span>
        </div>
        <ArticleActions slug={a.slug} title={l.title} locale={locale} isDe={locale === 'de'} />
        {a.video ? (
          <VideoPlayer
            video={a.video}
            src={a.video.url || a.video.embedUrl}
            poster={a.image}
            title={l.title}
            caption={a.video.caption}
          />
        ) : a.image ? (
          <figure className="art-hero-figure">
            <div className="art-hero-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image} alt={l.imageCaption || l.title} className="art-hero" loading="lazy" />
            </div>
            {(l.imageCaption || a.imageCredit) && (
              <figcaption className="art-hero-caption">
                {l.imageCaption && <span className="caption-text">{l.imageCaption}</span>}
                {a.imageCredit && <span className="caption-credit">Foto: {a.imageCredit}</span>}
              </figcaption>
            )}
          </figure>
        ) : null}
      </header>

      {l.isFallback && <div className="notice">EN</div>}

      {l.facts?.length > 0 && (
        <section className="facts">
          <h2>{t.keyFacts}</h2>
          <ul>{l.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </section>
      )}

      {a.category === 'sport' && (
        <section className="art-match-center">
          <MatchCenterView matchId="401921408" locale={locale} />
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
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                <span>{s.title}</span>
                <span className="ext-arrow" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                    <path d="M7 17L17 7M17 7H8M17 7V16" />
                  </svg>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="art-section">
        <h2>{t.howMade}</h2>
        <p className="howmade">{fmt(t.howMadeText, { n: outlets })}</p>
      </section>

      <ArticleComments slug={a.slug} locale={locale} isDe={locale === 'de'} />
    </article>
  );
}
