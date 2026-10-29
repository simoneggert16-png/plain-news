import { notFound } from 'next/navigation';
import { LOCALES, LOCALE_CODES, SITE, isLocale } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LiveBanner from '@/components/LiveBanner';
import { Analytics } from '@vercel/analytics/next';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource-variable/inter-tight/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import '../globals.css';
import '../live.css';
import '../pages.css';

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const canonicalUrl = `${SITE.url}/${locale}`;
  return {
    metadataBase: new URL(SITE.url),
    title: { default: `${SITE.name} — ${t.tagline}`, template: `%s — ${SITE.name}` },
    description: t.tagline + ' ' + t.footer,
    keywords: [
      'news',
      'neutral news',
      'unbiased journalism',
      'fact-checked news',
      'breaking news',
      'world news',
      'sports live ticker',
      'plain news',
      'nachrichten ohne meinungsmache',
      'echtzeit ticker',
    ],
    authors: [{ name: 'PLAIN. Editorial Team', url: SITE.url }],
    creator: 'PLAIN.',
    publisher: 'PLAIN.',
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((l) => [l, `${SITE.url}/${l}`])),
        'x-default': `${SITE.url}/en`,
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
      title: `${SITE.name} — ${t.tagline}`,
      description: t.tagline + ' ' + t.footer,
      url: canonicalUrl,
      siteName: SITE.name,
      locale: LOCALES.find((l) => l.code === locale)?.bcp47 || 'de_CH',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE.name} — ${t.tagline}`,
      description: t.tagline,
    },
  };
}

export const viewport = { themeColor: '#EAE3D2' };

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const organizationId = `${SITE.url}/#organization`;
  const websiteId = `${SITE.url}/#website`;
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsMediaOrganization',
        '@id': organizationId,
        name: SITE.name,
        alternateName: 'PLAIN News',
        url: SITE.url,
        description: `${SITE.name} — News without noise. Independent, ad-free, non-commercial news with two-source verification.`,
        slogan: 'News without noise.',
        logo: {
          '@type': 'ImageObject',
          url: `${SITE.url}/app-icon-1024.png`,
          width: 1024,
          height: 1024,
        },
        image: `${SITE.url}/app-icon-1024.png`,
        foundingDate: '2026',
        founder: { '@type': 'Person', name: 'Simon Eggert', url: `${SITE.url}/en/about` },
        publishingPrinciples: `${SITE.url}/${locale}/about`,
        masthead: `${SITE.url}/${locale}/about`,
        ethicsPolicy: `${SITE.url}/${locale}/about`,
        correctionsPolicy: `${SITE.url}/${locale}/about#corrections`,
        ownershipFundingInfo: `${SITE.url}/${locale}/about#funding`,
        actionableFeedbackPolicy: `${SITE.url}/${locale}/about#corrections`,
        diversityPolicy: `${SITE.url}/${locale}/about`,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'editorial',
          email: 'simoneggert16@gmail.com',
          availableLanguage: LOCALE_CODES,
        },
        knowsLanguage: LOCALE_CODES,
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: SITE.url,
        name: SITE.name,
        publisher: { '@id': organizationId },
        inLanguage: LOCALE_CODES,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE.url}/${locale}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <html lang={bcp}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <link rel="alternate" type="application/rss+xml" title={`${SITE.name} RSS`} href={`${SITE.url}/feed.xml`} />
        <link rel="alternate" type="text/plain" title="llms.txt" href={`${SITE.url}/llms.txt`} />
        <link rel="alternate" type="text/plain" title="llms-full.txt" href={`${SITE.url}/llms-full.txt`} />
        <meta name="author" content="PLAIN. Editorial Desk" />
        <meta name="publisher" content="PLAIN." />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var p = localStorage.getItem('plain_palette');
                if (p) document.documentElement.setAttribute('data-palette', p);
                var s = localStorage.getItem('plain_font_size');
                if (s) document.documentElement.setAttribute('data-font-size', s);
                var f = localStorage.getItem('plain_font_family');
                if (f) document.documentElement.setAttribute('data-font-family', f);
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body data-locale={locale}>
        <Header locale={locale} t={t} />
        <LiveBanner locale={locale} />
        <main className="wrap">{children}</main>
        <Footer locale={locale} t={t} />
        <Analytics />
      </body>
    </html>
  );
}
