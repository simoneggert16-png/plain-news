import { LOCALE_CODES, SITE } from '@/lib/config.mjs';
import LiveTickerView from '@/components/LiveTickerView';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isDe = locale === 'de';
  return {
    title: isDe ? 'Liveticker · PLAIN.' : 'Live Ticker · PLAIN.',
    description: isDe
      ? 'Echtzeit-Ticker zu Sport, Länderspielen, Weltpolitik, Wirtschaft und Eilmeldungen ohne Lärm.'
      : 'Real-time wire for sports, breaking world news, markets and politics.',
    siteName: SITE.name,
  };
}

export default async function TickerPage({ params }) {
  const { locale } = await params;
  const isDe = locale === 'de';

  return (
    <main className="wrap liveticker-page-wrap">
      <header className="liveticker-page-head">
        <div className="label label-inv">{isDe ? 'ECHTZEIT' : 'REAL-TIME'}</div>
        <h1 className="liveticker-page-title">
          {isDe ? 'Liveticker' : 'Live Ticker'}
        </h1>
        <p className="liveticker-page-dek">
          {isDe
            ? 'Laufend aktualisierte Meldungen aus Sport, Politik, Wirtschaft und Weltgeschehen. Wählen Sie Ihr Aktualisierungsintervall von 3 bis 60 Minuten.'
            : 'Continuous live coverage across sports, breaking world events, politics, and financial markets. Choose your auto-refresh rate from 3 to 60 minutes.'}
        </p>
      </header>

      <LiveTickerView locale={locale} initialFilter="all" />
    </main>
  );
}
