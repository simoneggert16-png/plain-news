'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { clock, dayLabel } from '@/lib/live.mjs';
import { getDict } from '@/lib/i18n.mjs';
import LiveStats from './LiveStats';

const POLL_MS = 30000;

function pick(locales, locale) {
  if (!locales) return null;
  return locales[locale] || locales.en || locales.de || null;
}

/**
 * Body of an article that belongs to a live ticker.
 *
 * The committed version is server-rendered (so crawlers and the first paint see
 * real content); this component then polls /api/live/article/<slug> and swaps in
 * the newest version without a redeploy. Every previous version stays readable
 * under "Earlier versions".
 */
export default function LiveArticle({
  slug,
  locale = 'de',
  initial,
  versions: initialVersions = [],
  tickerSlug = null,
  live = true,
}) {
  const [content, setContent] = useState(initial);
  const [versions, setVersions] = useState(initialVersions);
  const [stats, setStats] = useState(initial?.stats || null);
  const [isLive, setIsLive] = useState(live);
  const [updatedAt, setUpdatedAt] = useState(initial?.updatedAt || null);
  const [flash, setFlash] = useState(false);

  const updatedRef = useRef(initial?.updatedAt || null);
  const liveRef = useRef(live);
  const t = getDict(locale).live;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!liveRef.current) return;
      try {
        const res = await fetch(`/api/live/article/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive || data.live === undefined) return;
        const next = pick(data.locales, locale);
        if (!next) return;

        if (data.updatedAt && data.updatedAt !== updatedRef.current) {
          updatedRef.current = data.updatedAt;
          setFlash(true);
          setTimeout(() => setFlash(false), 3000);
        }
        liveRef.current = data.live !== false;
        setIsLive(liveRef.current);
        setUpdatedAt(data.updatedAt || null);
        setContent(next);
        if (data.stats !== undefined) setStats(data.stats || null);
        setVersions(Array.isArray(data.versions) ? data.versions : []);
      } catch {}
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [slug, locale]);

  const facts = content?.facts || [];
  const body = content?.body || [];

  return (
    <div className={`live-article ${flash ? 'is-fresh' : ''}`}>
      <div className="live-article-strip">
        <span className="live-article-state">
          <span className={`live-dot ${isLive ? 'is-on' : ''}`} aria-hidden="true" />
          <span className="live-article-state-text">{isLive ? t.live : t.ended}</span>
        </span>
        {updatedAt && (
          <>
            <span className="live-status-sep" aria-hidden="true">·</span>
            <span className="live-status-meta">{t.updated} <time dateTime={updatedAt}>{clock(updatedAt, locale)}</time></span>
          </>
        )}
        {tickerSlug && (
          <Link href={`/${locale}/live/${tickerSlug}`} className="live-article-strip-link">
            {t.nav} →
          </Link>
        )}
      </div>

      {stats && <LiveStats stats={stats} locale={locale} />}

      {facts.length > 0 && (
        <section className="facts">
          <h2>{getDict(locale).keyFacts}</h2>
          <ul>{facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </section>
      )}

      <div className="body">
        {body.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {content?.context && (
        <section className="art-section">
          <h2>{getDict(locale).context}</h2>
          <p>{content.context}</p>
        </section>
      )}

      {versions.length > 0 && (
        <section className="live-versions">
          <details>
            <summary>{t.versions} <span className="live-versions-count">({versions.length})</span></summary>
            <ol className="live-versions-list">
              {versions.map((v, i) => {
                const vl = pick(v.locales, locale);
                if (!vl) return null;
                return (
                  <li key={`${v.at || i}-${i}`} className="live-version">
                    <div className="live-version-head">
                      <span className="live-version-time">
                        <time dateTime={v.at}>{dayLabel(v.at, locale)} · {clock(v.at, locale)}</time>
                      </span>
                      {v.reason && <span className="live-version-reason">{v.reason}</span>}
                    </div>
                    <h3 className="live-version-title">{vl.title}</h3>
                    {vl.dek && <p className="live-version-dek">{vl.dek}</p>}
                    {vl.facts?.length > 0 && (
                      <ul className="live-version-facts">
                        {vl.facts.map((f, n) => <li key={n}>{f}</li>)}
                      </ul>
                    )}
                    {(vl.body || []).map((p, n) => <p key={n}>{p}</p>)}
                    {vl.context && <p className="live-version-context">{vl.context}</p>}
                  </li>
                );
              })}
            </ol>
          </details>
        </section>
      )}
    </div>
  );
}
