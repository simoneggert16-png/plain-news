import Link from 'next/link';
import { cookies } from 'next/headers';
import { LOCALES, CATEGORIES, SITE } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { listFor, localize } from '@/lib/content.mjs';
import { rankArticles, isElectionHeadline, sharesSubject } from '@/lib/storyRank.mjs';
import { listLiveTickers } from '@/lib/liveStore.mjs';
import { liveLocalize, liveUpdates, updateLocalize, clock } from '@/lib/live.mjs';
import { fmtDate, sourceLabel } from '@/lib/format.mjs';
import MarketStrip from '@/components/MarketStrip';
import Card from '@/components/Card';
import TopicFilter from '@/components/TopicFilter';

export default async function Home({ params }) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const topicsCookie = cookieStore.get('plain_topics')?.value;
  let allowedTopics = CATEGORIES;
  if (topicsCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(topicsCookie));
      if (Array.isArray(parsed) && parsed.length > 0) {
        allowedTopics = parsed;
      }
    } catch (e) {}
  }

  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const rawAll = await listFor();
  if (!rawAll.length) return <div className="empty">{t.empty}</div>;

  // Filter articles based on user preferences (server-side personalized)
  const all = rawAll.filter((a) => allowedTopics.includes(a.category));
  const displayArticles = all.length > 0 ? all : rawAll;

  // Lead = highest-impact story of the last 30h, not just the newest one.
  // Elections and wars stay on the front page for a day instead of being
  // buried by the next minor item that happens to publish at :26.
  const dayAgo = Date.now() - 30 * 36e5;
  const recent = displayArticles.filter((a) => Date.parse(a.publishedAt) >= dayAgo);
  const lead = rankArticles(recent.length ? recent : displayArticles)[0] || displayArticles[0];
  const rest = displayArticles.filter((a) => a.slug !== lead.slug);
  const brief = [];
  const fillTarget = 5 - electionPicks.length;
  for (const a of rankedRest) {
    if (brief.length >= fillTarget) break;
    if (electionPicks.includes(a) || isElectionHeadline(a)) continue;
    if (sharesSubject(a, lead)) continue;
    if (brief.some((b) => sharesSubject(a, b))) continue;
    brief.push(a);
  }
  brief.unshift(...electionPicks);
  // Live coverage of whatever is actually running (election night, war,
  // disaster, central bank decision). The tickers already exist - without this
  // they were only reachable via /live, which is why the running stories looked
  // absent from the front page.
  const liveNow = await listLiveTickers({ status: 'live', limit: 6 })
    .then(({ tickers }) => (tickers || []).slice(0, 3))
    .catch(() => []);
  // Long reads get their own band: they are the pieces we spent the day on.
  const longreads = rawAll.filter((a) => a.form === 'longform').slice(0, 3);
  const L = localize(lead, locale);
  const homeUrl = `${SITE.url}/${locale}`;
  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': homeUrl,
    url: homeUrl,
    name: `${SITE.name} — ${t.tagline}`,
    inLanguage: bcp,
    isPartOf: { '@id': `${SITE.url}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: [lead, ...brief].filter(Boolean).map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE.url}/${locale}/a/${article.slug}`,
        name: localize(article, locale).title,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }} />
      <TopicFilter locale={locale} t={t} />

      {liveNow.length > 0 && (
        <section className="live-strip" aria-label={t.live.nav}>
          <div className="live-strip-head">
            <span className="live-dot" aria-hidden="true" />
            <span className="live-strip-title">{t.live.nav}</span>
            <Link href={`/${locale}/live`} className="live-strip-all">{t.live.all} →</Link>
          </div>
          <ul className="live-strip-list">
            {liveNow.map((tk) => {
              const TT = liveLocalize(tk, locale);
              const last = liveUpdates(tk)[0];
              const lastLine = last ? updateLocalize(last, locale).headline : '';
              return (
                <li key={tk.slug}>
                  <Link href={`/${locale}/live/${tk.slug}`}>
                    <span className="live-strip-topic">{TT.title}</span>
                    {lastLine && (
                      <span className="live-strip-latest">
                        {clock(last.at, locale)} · {lastLine}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="lead-grid">
        <article className="lead">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <Link href={`/${locale}/c/${lead.category}`} className="label label-inv">{t.cat[lead.category]}</Link>
            {lead.video && (
              <span className="badge-video">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                VIDEO
              </span>
            )}
          </div>
          <Link href={`/${locale}/a/${lead.slug}`}>
            <h1>{L.title}</h1>
          </Link>
          {lead.image && (
            <div className="lead-hero-container">
              <Link href={`/${locale}/a/${lead.slug}`} className="lead-hero-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lead.image} alt={L.imageCaption || L.title} className="lead-hero" loading="eager" />
              </Link>
              {(L.imageCaption || lead.imageCredit) && (
                <div className="lead-hero-caption">
                  {L.imageCaption && <span className="caption-text">{L.imageCaption}</span>}
                  {lead.imageCredit && <span className="caption-credit">Foto: {lead.imageCredit}</span>}
                </div>
              )}
            </div>
          )}
          <p className="dek">{L.dek}</p>
          {L.facts?.length > 0 && (
            <ul className="lead-facts">
              {L.facts.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
          <div className="meta">
            {fmtDate(lead.publishedAt, bcp)} · {sourceLabel(lead, t)}
          </div>
        </article>
        <aside className="brief">
          <div className="label">{t.brief}</div>
          <ol className="brief-list">
            {brief.map((a) => (
              <li key={a.slug}>
                <Link href={`/${locale}/a/${a.slug}`}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="label">{t.cat[a.category]}</span>
                    {a.video && (
                      <span className="badge-video">
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        VIDEO
                      </span>
                    )}
                  </div>
                  <h3>{localize(a, locale).title}</h3>
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <div className="sec-head">
        <h2>{t.markets}</h2>
        <Link href={`/${locale}/markets`}>{t.markets} →</Link>
      </div>
      <MarketStrip locale={locale} />

      {longreads.length > 0 && (
        <section className="lr-band">
          <div className="sec-head">
            <h2>{t.longreads.latest}</h2>
            <Link href={`/${locale}/longreads`}>{t.longreads.nav} →</Link>
          </div>
          <div className="lr-band-grid">
            {longreads.map((a) => {
              const l = localize(a, locale);
              return (
                <Link key={a.slug} href={`/${locale}/a/${a.slug}`} className="lr-band-item">
                  <span className="label">{t.cat[a.category] || a.category}</span>
                  <h3>{l.title}</h3>
                  <p>{l.standfirst || l.dek}</p>
                  <span className="meta">
                    {fmtDate(a.publishedAt, bcp)}
                    {a.readingMinutes ? ` · ${fmt(t.minRead, { n: a.readingMinutes })}` : ''}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <>
          <div className="sec-head">
            <h2>{t.latest}</h2>
          </div>
          <div className="grid grid-top">
            {rest.slice(0, 12).map((a) => <Card key={a.slug} a={a} locale={locale} t={t} bcp={bcp} />)}
          </div>
        </>
      )}

      {CATEGORIES.map((c) => {
        const items = all.filter((a) => a.category === c);
        if (items.length === 0) return null;
        return (
          <section key={c}>
            <div className="sec-head">
              <h2>{t.cat[c]}</h2>
              <Link href={`/${locale}/c/${c}`}>{t.more} →</Link>
            </div>
            <div className="grid grid-top">
              {items.slice(0, 9).map((a) => <Card key={a.slug} a={a} locale={locale} t={t} bcp={bcp} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
