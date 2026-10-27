'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clock } from '@/lib/live.mjs';
import { getDict } from '@/lib/i18n.mjs';

export const LIVE_BANNER_KEY = 'plain_live_banner_off';

/**
 * Dismissible global banner for the most important active live ticker.
 * Hidden per user (localStorage) and globally via NEXT_PUBLIC_LIVE_BANNER=0.
 */
export default function LiveBanner({ locale = 'de' }) {
  const [ticker, setTicker] = useState(null);
  const [hidden, setHidden] = useState(true);
  const t = getDict(locale).live;

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LIVE_BANNER === '0') return;
    try {
      if (localStorage.getItem(LIVE_BANNER_KEY) === '1') setHidden(true);
      else setHidden(false);
    } catch {
      setHidden(false);
    }

    const show = () => {
      try { localStorage.removeItem(LIVE_BANNER_KEY); } catch {}
      setHidden(false);
    };
    window.addEventListener('plain-live-banner-on', show);
    return () => window.removeEventListener('plain-live-banner-on', show);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/live?locale=${locale}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        const top = (data.tickers || [])
          .filter((x) => x.status === 'live')
          .sort((a, b) => (b.importance || 0) - (a.importance || 0) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
        setTicker(top || null);
      } catch {}
    };
    load();
    const id = setInterval(load, 45000);
    return () => { alive = false; clearInterval(id); };
  }, [locale]);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(LIVE_BANNER_KEY, '1'); } catch {}
  };

  if (hidden || !ticker) return null;

  return (
    <div className="live-banner" role="status" aria-live="polite">
      <div className="wrap live-banner-inner">
        <Link href={`/${locale}/live/${ticker.slug}`} className="live-banner-link">
          <span className="live-banner-dot" aria-hidden="true" />
          <span className="live-banner-tag">LIVE</span>
          <span className="live-banner-title">{ticker.title}</span>
          {ticker.latest?.headline && (
            <span className="live-banner-latest">
              <span className="live-banner-sep" aria-hidden="true">/</span>
              {ticker.latest.headline}
            </span>
          )}
        </Link>
        <span className="live-banner-right">
          {ticker.latest?.at && <span className="live-banner-time">{clock(ticker.latest.at, locale)}</span>}
          <span className="live-banner-count">
            {ticker.updateCount} {t.updates}
          </span>
          <button type="button" className="live-banner-close" onClick={dismiss} title={t.bannerOff} aria-label={t.bannerOff}>
            ✕
          </button>
        </span>
      </div>
    </div>
  );
}
