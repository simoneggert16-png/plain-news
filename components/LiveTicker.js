'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { liveUpdates, updateLocalize, kindLabel, clock, dayLabel, liveLocalize, liveStats } from '@/lib/live.mjs';
import { getDict } from '@/lib/i18n.mjs';
import LiveStats from './LiveStats';

const POLL_MS = 20000;

/**
 * Live blog for one event. Server-rendered for crawlers, then it polls
 * /api/live/<slug> so new updates appear without a reload.
 */
export default function LiveTicker({ ticker: initial, locale = 'de' }) {
  const [ticker, setTicker] = useState(initial);
  const [fresh, setFresh] = useState(() => new Set());
  const [pulse, setPulse] = useState(false);
  const seenRef = useRef(new Set((initial.updates || []).map((u) => u.id)));
  const t = getDict(locale).live;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(initial.slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const next = await res.json();
        if (!alive || !next?.slug) return;
        const added = (next.updates || []).filter((u) => !seenRef.current.has(u.id));
        (next.updates || []).forEach((u) => seenRef.current.add(u.id));
        if (added.length || next.updatedAt !== ticker.updatedAt) {
          setTicker(next);
          if (added.length) {
            setFresh(new Set(added.map((u) => u.id)));
            setPulse(true);
            setTimeout(() => setPulse(false), 2500);
            setTimeout(() => setFresh(new Set()), 15000);
          }
        }
      } catch {}
    };
    const id = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [initial.slug, ticker.updatedAt]);

  const updates = useMemo(() => liveUpdates(ticker), [ticker]);
  const lead = updates[0];
  const rest = updates.slice(1);
  const title = liveLocalize(ticker, locale);
  const stats = useMemo(() => liveStats(ticker, locale), [ticker, locale]);
  const sources = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const u of updates) for (const s of u.sources || []) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      list.push(s);
    }
    return list;
  }, [updates]);
  const outletCount = useMemo(() => new Set(sources.map((s) => s.outlet)).size, [sources]);

  const groups = useMemo(() => {
    const out = [];
    for (const u of rest) {
      const day = dayLabel(u.at, locale);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(u);
      else out.push({ day, items: [u] });
    }
    return out;
  }, [rest, locale]);

  const renderUpdate = (u, i, leadItem = false) => {
    const l = updateLocalize(u, locale);
    const isNew = fresh.has(u.id);
    return (
      <article key={u.id} className={`live-update ${leadItem ? 'is-lead' : ''} ${isNew ? 'is-new' : ''}`}>
        <div className="live-update-time">
          <time dateTime={u.at}>{clock(u.at, locale)}</time>
          <span className="live-kind">{kindLabel(u.kind, locale)}</span>
        </div>
        <div className="live-update-body">
          <h3 className="live-update-headline">{l.headline}</h3>
          {l.body && <p className="live-update-text">{l.body}</p>}
          {u.sources?.length > 0 && (
            <div className="live-update-sources">
              {u.sources.slice(0, 4).map((s, n) => (
                <a key={n} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="live-source">
                  {s.outlet}
                </a>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="live-ticker">
      <header className="live-head">
        <div className="live-status">
          <span className={`live-dot ${ticker.status === 'live' ? 'is-on' : ''} ${pulse ? 'is-pulse' : ''}`} aria-hidden="true" />
          <span className="live-status-text">{ticker.status === 'live' ? t.live : t.ended}</span>
          <span className="live-status-sep">·</span>
          <span className="live-status-meta">{updates.length} {t.updates}</span>
          <span className="live-status-sep">·</span>
          <span className="live-status-meta">{outletCount} {t.sources}</span>
          {ticker.updatedAt && (
            <>
              <span className="live-status-sep">·</span>
              <span className="live-status-meta">{t.updated}: {clock(ticker.updatedAt, locale)}</span>
            </>
          )}
        </div>
        <h1 className="live-title">{title.title}</h1>
        {title.dek && <p className="live-dek">{title.dek}</p>}
        <div className="live-head-foot">
          <span className="live-auto">{t.auto}</span>
          {ticker.articleSlug && (
            <Link href={`/${locale}/a/${ticker.articleSlug}`} className="live-article-link">
              {t.story} →
            </Link>
          )}
        </div>
      </header>

      {!updates.length && <div className="live-empty">{t.emptyTicker}</div>}

      {stats && (
        <div className="live-stats-wrap">
          <LiveStats stats={ticker.stats} locale={locale} />
        </div>
      )}

      {lead && (
        <section className="live-lead-wrap">
          <div className="live-section-label">{t.latest}</div>
          {renderUpdate(lead, 0, true)}
        </section>
      )}

      {groups.map((g) => (
        <section key={g.day} className="live-day">
          <div className="live-day-label">{g.day}</div>
          {g.items.map((u, i) => renderUpdate(u, i))}
        </section>
      ))}

      {sources.length > 0 && (
        <section className="live-sources-block">
          <div className="live-section-label">{t.sources} ({outletCount})</div>
          <ul className="live-sources-list">
            {sources.slice(0, 40).map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                  <span className="outlet">{s.outlet}</span>
                  <span className="live-source-title">{s.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="live-foot">
        <p>{t.footnote}</p>
      </footer>
    </div>
  );
}
