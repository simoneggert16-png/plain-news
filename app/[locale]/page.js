import Link from 'next/link';
import { LOCALES, CATEGORIES } from '@/lib/config.mjs';
import { getDict, fmt } from '@/lib/i18n.mjs';
import { listFor, localize } from '@/lib/content.mjs';
import { fmtDate } from '@/lib/format.mjs';
import MarketStrip from '@/components/MarketStrip';
import Card from '@/components/Card';

export default async function Home({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const bcp = LOCALES.find((l) => l.code === locale).bcp47;
  const all = listFor();

  if (!all.length) return <div className="empty">{t.empty}</div>;

  // Lead = most important story of the last 24h, else newest.
  const dayAgo = Date.now() - 864e5;
  const lead = [...all.filter((a) => new Date(a.publishedAt) > dayAgo)].sort((a, b) => (b.importance || 0) - (a.importance || 0))[0] || all[0];
  const rest = all.filter((a) => a.slug !== lead.slug);
  const brief = rest.slice(0, 5);
  const latest = rest.slice(5, 14);
  const L = localize(lead, locale);

  return (
    <>
      <section className="lead-grid">
        <article className="lead">
          <Link href={`/${locale}/c/${lead.category}`} className="label label-inv">{t.cat[lead.category]}</Link>
          <Link href={`/${locale}/a/${lead.slug}`}>
            <h1>{L.title}</h1>
          </Link>
          {lead.image && (
            <Link href={`/${locale}/a/${lead.slug}`} className="lead-hero-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lead.image} alt="" className="lead-hero" loading="eager" />
            </Link>
          )}
          <p className="dek">{L.dek}</p>
          {L.facts?.length > 0 && (
            <ul className="lead-facts">
              {L.facts.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
          <div className="meta">
            {fmtDate(lead.publishedAt, bcp)} · {t.sources}: {lead.sourceCount}
          </div>
        </article>
        <aside className="brief">
          <div className="label">{t.brief}</div>
          <ol className="brief-list">
            {brief.map((a) => (
              <li key={a.slug}>
                <Link href={`/${locale}/a/${a.slug}`}>
                  <span className="label">{t.cat[a.category]}</span>
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

      {latest.length > 0 && (
        <>
          <div className="sec-head"><h2>{t.latest}</h2></div>
          <div className="grid grid-top">
            {latest.map((a) => <Card key={a.slug} a={a} locale={locale} t={t} bcp={bcp} />)}
          </div>
        </>
      )}

      {CATEGORIES.map((c) => {
        const items = all.filter((a) => a.category === c).slice(0, 4);
        if (items.length < 2) return null;
        return (
          <section key={c}>
            <div className="sec-head">
              <h2>{t.cat[c]}</h2>
              <Link href={`/${locale}/c/${c}`}>{t.more} →</Link>
            </div>
            <div className="grid grid-4 grid-top">
              {items.map((a) => <Card key={a.slug} a={a} locale={locale} t={t} bcp={bcp} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
