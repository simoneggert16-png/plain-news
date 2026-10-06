'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const SPORT_FILTERS = [
  { id: 'all', de: 'Alle Sportarten', en: 'All Sports' },
  { id: 'football', de: 'Fußball', en: 'Football' },
  { id: 'tennis', de: 'Tennis', en: 'Tennis' },
  { id: 'f1', de: 'Formel 1', en: 'Formula 1' },
  { id: 'basketball', de: 'Basketball', en: 'Basketball' },
  { id: 'nfl', de: 'NFL', en: 'NFL' },
  { id: 'eishockey', de: 'Eishockey', en: 'Ice Hockey' },
  { id: 'cycling', de: 'Radsport', en: 'Cycling' },
  { id: 'golf', de: 'Golf', en: 'Golf' },
  { id: 'cricket', de: 'Cricket', en: 'Cricket' },
];

const INTERVALS = [
  { label: '3 Min', sec: 180 },
  { label: '5 Min', sec: 300 },
  { label: '15 Min', sec: 900 },
];

export default function SportsLiveSidebar({ locale = 'de' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState('all');
  const [intervalSec, setIntervalSec] = useState(180);
  const [countdown, setCountdown] = useState(180);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isDe = locale === 'de';

  const fetchSportsTicker = useCallback(async () => {
    try {
      const res = await fetch('/api/ticker/full');
      if (res.ok) {
        const data = await res.json();
        // Keep only sport items
        const sportsOnly = data.filter((x) => x.type === 'sport');
        setItems(sportsOnly);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to update sports sidebar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSportsTicker();
  }, [fetchSportsTicker]);

  useEffect(() => {
    setCountdown(intervalSec);
    const intervalTimer = setInterval(() => {
      fetchSportsTicker();
      setCountdown(intervalSec);
    }, intervalSec * 1000);

    const countdownTimer = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : intervalSec));
    }, 1000);

    return () => {
      clearInterval(intervalTimer);
      clearInterval(countdownTimer);
    };
  }, [intervalSec, fetchSportsTicker]);

  const filteredItems = items.filter((item) => {
    if (sportFilter === 'all') return true;
    return item.sportType === sportFilter;
  });

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <aside className="sport-sidebar-widget">
      {/* Widget Header */}
      <div className="sport-sidebar-head">
        <div className="sport-sidebar-title-row">
          <div className="sport-live-indicator">
            <span className="live-dot" />
            <strong>{isDe ? 'LIVE-SPORTTICKER' : 'LIVE SPORTS WIRE'}</strong>
          </div>
          <div className="sport-sidebar-refresh-ctrl">
            <div className="sport-intervals">
              {INTERVALS.map((int) => (
                <button
                  key={int.sec}
                  type="button"
                  onClick={() => {
                    setIntervalSec(int.sec);
                    setCountdown(int.sec);
                  }}
                  className={`sport-interval-btn ${intervalSec === int.sec ? 'active' : ''}`}
                >
                  {int.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchSportsTicker();
                setCountdown(intervalSec);
              }}
              className="sport-refresh-now-btn"
              title={isDe ? 'Jetzt aktualisieren' : 'Refresh now'}
            >
              ⟳ <span className="sport-countdown">({formatCountdown(countdown)})</span>
            </button>
          </div>
        </div>

        {/* Top 10 World Sports Filter Pills */}
        <div className="sport-pills-bar" aria-label="Sportarten Filter">
          {SPORT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSportFilter(f.id)}
              className={`sport-pill ${sportFilter === f.id ? 'active' : ''}`}
            >
              {isDe ? f.de : f.en}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Live Ticker Feed */}
      <div className="sport-sidebar-scroll-area">
        {loading && items.length === 0 ? (
          <div className="sport-ticker-empty">{isDe ? 'Lade Sport-Meldungen…' : 'Loading live scores…'}</div>
        ) : filteredItems.length === 0 ? (
          <div className="sport-ticker-empty">
            {isDe ? 'Keine aktuellen Ticker-Meldungen für diese Sportart.' : 'No live updates for this sport currently.'}
          </div>
        ) : (
          filteredItems.map((item) => {
            const timeStr = item.time
              ? new Date(item.time).toLocaleTimeString(isDe ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
              : '';
            const isLiveBadge = item.badge === 'LIVE' || item.badge === 'LÄNDERSPIEL';

            const card = (
              <article className={`sport-ticker-card ${isLiveBadge ? 'is-live' : ''}`}>
                <div className="sport-ticker-meta-top">
                  <span className={`sport-badge-pill ${isLiveBadge ? 'badge-live' : 'badge-sport'}`}>
                    {isLiveBadge ? '● ' : ''}{item.badge}
                  </span>
                  <div className="sport-meta-right">
                    <span className="sport-time-tag">{timeStr}</span>
                    {item.source && <span className="sport-source-tag">{item.source}</span>}
                  </div>
                </div>
                <h4 className="sport-ticker-headline">{item.title}</h4>
                {item.detail && <p className="sport-ticker-snippet">{item.detail}</p>}
              </article>
            );

            if (item.slug) {
              return (
                <Link key={item.id} href={`/${locale}/a/${item.slug}`} className="sport-ticker-card-link">
                  {card}
                </Link>
              );
            }
            if (item.url) {
              return (
                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="sport-ticker-card-link">
                  {card}
                </a>
              );
            }
            return <div key={item.id}>{card}</div>;
          })
        )}
      </div>

      {lastUpdated && (
        <div className="sport-sidebar-footer">
          <span>{isDe ? 'Stand' : 'Updated'}: {lastUpdated.toLocaleTimeString(isDe ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>{filteredItems.length} {isDe ? 'Meldungen' : 'Updates'}</span>
        </div>
      )}
    </aside>
  );
}
