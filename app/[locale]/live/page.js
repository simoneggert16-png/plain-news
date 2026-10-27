import Link from 'next/link';
import { LOCALE_CODES, SITE } from '@/lib/config.mjs';
import { getDict } from '@/lib/i18n.mjs';
import { clock, liveSummary } from '@/lib/live.mjs';
import { listLiveTickers } from '@/lib/liveStore.mjs';
import LiveBannerToggle from '@/components/LiveBannerToggle';

// Tickers change every few minutes and live in Supabase, not in the build.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  return {
    title: `${t.live.nav} · ${SITE.name}`,
    description: t.live.auto,
    alternates: {
      canonical: `${SITE.url}/${locale}/live`,
      languages: {
        ...Object.fromEntries(LOCALE_CODES.map((l) => [l, `${SITE.url}/${l}/live`])),
        'x-default': `${SITE.url}/en/live`,
      },
    },
    openGraph: {
      title: `${t.live.nav} · ${SITE.name}`,
      description: t.live.auto,
      url: `${SITE.url}/${locale}/live`,
      siteName: SITE.name,
      type: 'website',
    },
  };
}

function Card({ s, locale, t }) {
  return (
    <Link href={`/${locale}/live/${s.slug}`} className={`live-card ${s.status === 'live' ? 'is-live' : 'is-ended'}`}>
      <div className="live-card-top">
        <span className="live-card-state">
          <span className={`live-dot ${s.status === 'live' ? 'is-on' : ''}`} aria-hidden="true" />
          {s.status === 'live' ? t.live : t.ended}
        </span>
        <span className="live-card-count">{s.updateCount} {t.updates}</span>
      </div>
      <h2 className="live-card-title">{s.title}</h2>
      {s.dek && <p className="live-card-dek">{s.dek}</p>}
      {s.latest?.headline && (
        <p className="live-card-latest">
          <span className="live-card-latest-time">{clock(s.latest.at, locale)}</span>
          {s.latest.headline}
        </p>
      )}
      <div className="live-card-foot">
        {t.updated} {clock(s.updatedAt, locale)}
        {s.startedAt && <span className="live-card-since"> · {t.since} {clock(s.startedAt, locale)}</span>}
      </div>
    </Link>
  );
}

export default async function LiveIndexPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale).live;

  const [activeRes, endedRes] = await Promise.all([
    listLiveTickers({ status: 'live', limit: 20 }),
    listLiveTickers({ status: 'ended', limit: 20 }),
  ]);
  const active = activeRes.tickers.map((x) => liveSummary(x, locale));
  const ended = endedRes.tickers.map((x) => liveSummary(x, locale));

  return (
    <div className="live-page">
      <header className="live-page-head">
        <div className="label label-inv">{t.live.toUpperCase()}</div>
        <h1 className="live-page-title">{t.nav}</h1>
        <p className="live-page-dek">{t.auto}</p>
        <LiveBannerToggle locale={locale} />
      </header>

      {active.length === 0 && ended.length === 0 && <p className="live-page-empty">{t.empty}</p>}

      {active.length > 0 && (
        <section className="live-page-section">
          <h2 className="live-section-label">{t.active}</h2>
          <div className="live-grid">
            {active.map((s) => <Card key={s.slug} s={s} locale={locale} t={t} />)}
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section className="live-page-section">
          <h2 className="live-section-label">{t.past}</h2>
          <div className="live-grid">
            {ended.map((s) => <Card key={s.slug} s={s} locale={locale} t={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}
