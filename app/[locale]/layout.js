import { notFound } from 'next/navigation';
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { LOCALES, LOCALE_CODES, SITE, isLocale } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Analytics } from '@vercel/analytics/react';
import '../globals.css';

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--f-serif', display: 'swap' });
const sans = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '600', '800', '900'], variable: '--f-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--f-mono', display: 'swap' });

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  return {
    metadataBase: new URL(SITE.url),
    title: { default: `${SITE.name} — ${t.tagline}`, template: `%s — ${SITE.name}` },
    description: t.tagline + ' ' + t.footer,
    alternates: {
      languages: Object.fromEntries(LOCALE_CODES.map((l) => [l, `/${l}`])),
    },
    openGraph: { siteName: SITE.name, type: 'website' },
  };
}

export const viewport = { themeColor: '#EAE3D2' };

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;

  return (
    <html lang={bcp} className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body data-locale={locale}>
        <Header locale={locale} t={t} />
        <main className="wrap">{children}</main>
        <Footer locale={locale} t={t} />
        <Analytics />
      </body>
    </html>
  );
}
