import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { getArticle, getIndex, localize, readingMinutes } from '@/lib/content.mjs';
import { fmtDate, sourceLabel } from '@/lib/format.mjs';
import VideoPlayer from '@/components/VideoPlayer';
import ArticleActions from '@/components/ArticleActions';
import ArticleComments from '@/components/ArticleComments';
import LiveArticle from '@/components/LiveArticle';

// Article pages are rendered on demand and cached by ISR (1h). Pre-rendering
// every story in every language produced ~7,000 HTML files per deployment
// (~700 MB and growing), which exhausted Vercel's 10 GB deployment storage.
// The latest stories stay pre-rendered by generateStaticParams below.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = (await getIndex()).slice(0, 40).map((a) => a.slug);
  return LOCALE_CODES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const a = await getArticle(slug);
  if (!a) return {};
  const l = localize(a, locale);
  const articleUrl = `${SITE.url}/${locale}/a/${slug}`;
  return {
    title: l.title,
    description: l.dek,
    keywords: [l.title, a.category, ...(l.facts || []).slice(0, 4)],
    authors: [{ name: 'PLAIN. Editorial Desk', url: `${SITE.url}/${locale}/about` }],
    creator: 'PLAIN. Editorial Desk',
    publisher: SITE.name,
    alternates: {
      canonical: articleUrl,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((c) => [c, `${SITE.url}/${c}/a/${slug}`])),
        'x-default': `${SITE.url}/en/a/${slug}`,
      },
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
  const a = await getArticle(slug);
  if (!a) notFound();
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const l = localize(a, locale);
  const outlets = new Set(a.sources.map((s) => s.outlet)).size;
  const articleUrl = `${SITE.url}/${locale}/a/${slug}`;
  const categoryUrl = `${SITE.url}/${locale}/c/${a.category}`;
  const absolute = (url) => {
    try { return new URL(url, SITE.url).toString(); } catch { return url; }
  };
  const bodyText = l.sections?.length
    ? l.sections.flatMap((s) => [s.heading || '', ...(s.paragraphs || [])])
    : (l.body || []);
  const articleBody = [l.dek, l.standfirst || '', ...(l.facts || []), ...bodyText, l.context || '']
    .filter(Boolean)
    .join('\n\n');
  const wordCount = articleBody.split(/\s+/).filter(Boolean).length;

  // Articles that belong to a live ticker keep their body in sync with the
  // ticker (client-side), while the committed version stays server-rendered.
  const isLive = Boolean(a.live);
  const liveInitial = {
    title: l.title,
    dek: l.dek,
    facts: l.facts || [],
    body: l.body || [],
    context: l.context || '',
    updatedAt: a.updatedAt || a.publishedAt,
    stats: a.stats || null,
  };
  const liveVersions = Array.isArray(a.history)
    ? a.history.filter((v) => v?.locales?.en || v?.locales?.de)
    : [];

  // Long reads carry structured sections; normal reports a flat paragraph list.
  const isLongform = a.form === 'longform' && Array.isArray(l.sections) && l.sections.length > 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        '@id': `${articleUrl}#article`,
        isPartOf: { '@id': `${SITE.url}/#website` },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': articleUrl,
        },
        url: articleUrl,
        headline: l.title,
        description: l.dek,
        articleSection: a.category,
        articleBody,
        wordCount,
        timeRequired: `PT${readingMinutes(a, locale)}M`,
        image: a.image ? [absolute(a.image)] : undefined,
        thumbnailUrl: a.image ? absolute(a.image) : undefined,
        datePublished: a.publishedAt,
        dateModified: a.updatedAt || a.publishedAt,
        inLanguage: bcp,
        isAccessibleForFree: true,
        isBasedOn: a.sources.map((s) => s.url),
        citation: a.sources.map((s) => ({
          '@type': 'CreativeWork',
          name: s.title,
          url: s.url,
          publisher: { '@type': 'Organization', name: s.outlet },
        })),
        author: {
          '@type': 'Organization',
          name: 'PLAIN. Editorial Desk',
          url: `${SITE.url}/${locale}/about`,
        },
        publisher: {
          '@type': 'NewsMediaOrganization',
          '@id': `${SITE.url}/#organization`,
          name: SITE.name,
          url: SITE.url,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE.url}/app-icon-1024.png`,
            width: 1024,
            height: 1024,
          },
        },
        copyrightHolder: { '@id': `${SITE.url}/#organization` },
        license: `${SITE.url}/en/legal`,
        about: { '@type': 'Thing', name: l.title },
        keywords: [a.category, l.title, ...(l.facts || []).slice(0, 5)].join(', '),
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', '.dek', '.facts'],
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${articleUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE.name,
            item: `${SITE.url}/${locale}`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: t.cat[a.category] || a.category,
            item: categoryUrl,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: l.title,
            item: articleUrl,
          },
        ],
      },
    ],
  };

  return (
    <article className="article">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="art-head">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <Link href={`/${locale}/c/${a.category}`} className="label label-inv">{t.cat[a.category]}</Link>
          {isLive && (
            <Link href={`/${locale}/live/${a.liveSlug || a.slug}`} className="badge-live">
              <span className="badge-live-dot" aria-hidden="true" />
              {t.live.nav}
            </Link>
          )}
          {a.video && (
            <span className="badge-video">
              <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              VIDEO
            </span>
          )}
          {isLongform && (
            <Link href={`/${locale}/longreads`} className="badge-form">
              {t.longreads.badge}
            </Link>
          )}
        </div>
        <h1>{l.title}</h1>
        <p className="dek">{l.dek}</p>
        {isLongform && l.standfirst && <p className="standfirst">{l.standfirst}</p>}
        <div className="art-meta meta">
          <span>{locale === 'de' ? 'Von' : 'By'} PLAIN. Editorial Desk</span>
          <span>
            {locale === 'de' ? 'Veröffentlicht' : 'Published'}{' '}
            <time dateTime={a.publishedAt}>{fmtDate(a.publishedAt, bcp, { year: 'numeric' })}</time>
          </span>
          {a.updatedAt && a.updatedAt !== a.publishedAt && (
            <span>{t.updated} <time dateTime={a.updatedAt}>{fmtDate(a.updatedAt, bcp)}</time></span>
          )}
          <span>{fmt(t.minRead, { n: readingMinutes(a, locale) })}</span>
          <span>{sourceLabel({ ...a, sourceCount: outlets }, t)}</span>
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

      {isLive ? (
        <LiveArticle
          slug={a.slug}
          locale={locale}
          initial={liveInitial}
          versions={liveVersions}
          tickerSlug={a.liveSlug || null}
          live
        />
      ) : (
        <>
          {l.facts?.length > 0 && (
            <section className="facts">
              <h2>{t.keyFacts}</h2>
              <ul>{l.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </section>
          )}

          {isLongform ? (
            <div className="body longform">
              {l.sections.map((s, i) => (
                <section className="lf-section" key={i}>
                  {s.heading && <h2>{s.heading}</h2>}
                  {(s.paragraphs || []).map((p, j) => <p key={j}>{p}</p>)}
                </section>
              ))}
            </div>
          ) : (
            <div className="body">
              {(l.body || []).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}

          {l.context && (
            <section className="art-section">
              <h2>{t.context}</h2>
              <p>{l.context}</p>
            </section>
          )}
        </>
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

      <section className="art-section" id="corrections">
        <h2>{t.howMade}</h2>
        <p className="howmade">{fmt(t.howMadeText, { n: outlets })}</p>
        <p className="howmade">
          {locale === 'de' ? 'Korrekturhinweis oder Quellenbeleg?' : 'Correction or source request?'}{' '}
          <a href="mailto:simoneggert16@gmail.com">simoneggert16@gmail.com</a>
        </p>
      </section>

      <ArticleComments slug={a.slug} locale={locale} isDe={locale === 'de'} />
    </article>
  );
}
