import Link from 'next/link';
import { cookies } from 'next/headers';
import { LOCALES, CATEGORIES } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { listFor, localize } from '@/lib/content.mjs';
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
  const rawAll = listFor();

  if (!rawAll.length) return <div className="empty">{t.empty}</div>;

  // Filter articles based on user preferences (server-side personalized)
  const all = rawAll.filter((a) => allowedTopics.includes(a.category));
  const displayArticles = all.length > 0 ? all : rawAll;

  // Lead = most important story of the last 24h, else newest.
  const dayAgo = Date.now() - 864e5;
  const lead = [...displayArticles.filter((a) => new Date(a.publishedAt) > dayAgo)].sort((a, b) => (b.importance || 0) - (a.importance || 0))[0] || displayArticles[0];
  const rest = displayArticles.filter((a) => a.slug !== lead.slug);
  const brief = rest.slice(0, 5);
  const latest = rest.slice(5, 14);
  const L = localize(lead, locale);

  return (
    <>
      <TopicFilter locale={locale} t={t} />

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

      {rest.length > 0 && (
        <>
          <div className="sec-head">
            <h2>{t.latest} ({rest.length})</h2>
          </div>
          <div className="grid grid-top">
            {rest.map((a) => <Card key={a.slug} a={a} locale={locale} t={t} bcp={bcp} />)}
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
              {items.map((a) => <Card key={a.slug} a={a} locale={locale} t={t} bcp={bcp} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
