'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const INTERVALS = [
  { label: '3 Min', sec: 180 },
  { label: '5 Min', sec: 300 },
  { label: '15 Min', sec: 900 },
  { label: '30 Min', sec: 1800 },
  { label: '60 Min', sec: 3600 },
];

const FILTERS = [
  { id: 'all', de: 'Alle Meldungen', en: 'All' },
  { id: 'sport', de: 'Sport & LÃ¤nderspiele', en: 'Sport & Live Matches' },
  { id: 'politics', de: 'Politik', en: 'Politics' },
  { id: 'business', de: 'Wirtschaft & MÃ¤rkte', en: 'Business & Markets' },
  { id: 'world', de: 'Welt', en: 'World' },
  { id: 'tech', de: 'Tech & Wissenschaft', en: 'Tech & Science' },
];

export default function LiveTickerView({ locale = 'de', initialFilter = 'all' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [sportSubFilter, setSportSubFilter] = useState('all');
  const [intervalSec, setIntervalSec] = useState(180); // default: 3 min
  const [countdown, setCountdown] = useState(180);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isDe = locale === 'de';

  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch('/api/ticker/full');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to update live ticker:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTicker();
  }, [fetchTicker]);

  // Read URL filter param if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const f = params.get('filter');
      if (f && FILTERS.some((x) => x.id === f)) {
        setFilter(f);
      }
    }
  }, []);

  // Interval timer and countdown
  useEffect(() => {
    setCountdown(intervalSec);
    const intervalTimer = setInterval(() => {
      fetchTicker();
      setCountdown(intervalSec);
    }, intervalSec * 1000);

    const countdownTimer = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : intervalSec));
    }, 1000);

    return () => {
      clearInterval(intervalTimer);
      clearInterval(countdownTimer);
    };
  }, [intervalSec, fetchTicker]);

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'sport') {
      if (item.type !== 'sport') return false;
      if (sportSubFilter !== 'all') return item.sportType === sportSubFilter;
      return true;
    }
    if (filter === 'politics') return item.type === 'politics';
    if (filter === 'business') return item.type === 'business';
    if (filter === 'world') return item.type === 'world';
    if (filter === 'tech') return item.type === 'tech' || item.type === 'science';
    return item.type === filter;
  });

  // High-impact stories (elections, wars, disasters) stay on top of their
  // filter for the whole day; everything else remains chronological.
  const orderedItems = [...filteredItems].sort(
    (a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0) || Date.parse(b.time) - Date.parse(a.time),
  );

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="liveticker-container">
      {/* Ticker Control Bar */}
      <div className="liveticker-controls">
        <div className="liveticker-status">
          <span className="liveticker-live-dot" />
          <span className="liveticker-status-text">
            {isDe ? 'ECHTZEIT-TICKER' : 'REAL-TIME TICKER'}
          </span>
          {lastUpdated && (
            <span className="liveticker-timestamp">
              {isDe ? 'Stand' : 'Updated'}: {lastUpdated.toLocaleTimeString(isDe ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {/* Interval Selector Buttons */}
        <div className="liveticker-refresh-bar">
          <span className="liveticker-refresh-label">
            {isDe ? 'Aktualisierung:' : 'Refresh rate:'}
          </span>
          <div className="liveticker-intervals">
            {INTERVALS.map((int) => (
              <button
                key={int.sec}
                type="button"
                onClick={() => {
                  setIntervalSec(int.sec);
                  setCountdown(int.sec);
                }}
                className={`liveticker-btn ${intervalSec === int.sec ? 'active' : ''}`}
              >
                {int.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchTicker();
              setCountdown(intervalSec);
            }}
            className="liveticker-btn-refresh"
            title={isDe ? 'Jetzt aktualisieren' : 'Refresh now'}
          >
            <span className={`refresh-icon ${loading ? 'spin' : ''}`}>âŸ³</span>
            <span className="countdown-text">({formatCountdown(countdown)})</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="liveticker-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              if (f.id !== 'sport') setSportSubFilter('all');
            }}
            className={`liveticker-filter-btn ${filter === f.id ? 'active' : ''}`}
          >
            {isDe ? f.de : f.en}
          </button>
        ))}
      </div>

      {/* Sub-Filters for Sports (Top 10 world sports) */}
      {filter === 'sport' && (
        <div className="sport-pills-bar" style={{ padding: '8px 16px', background: 'var(--paper-2)', borderBottom: 'var(--rule)' }}>
          {[
            { id: 'all', de: 'Alle', en: 'All' },
            { id: 'football', de: 'FuÃŸball & LÃ¤nderspiele', en: 'Football' },
            { id: 'tennis', de: 'Tennis', en: 'Tennis' },
            { id: 'f1', de: 'Formel 1', en: 'Formula 1' },
            { id: 'basketball', de: 'Basketball', en: 'Basketball' },
            { id: 'nfl', de: 'NFL', en: 'NFL' },
            { id: 'eishockey', de: 'Eishockey', en: 'Ice Hockey' },
            { id: 'cycling', de: 'Radsport', en: 'Cycling' },
            { id: 'golf', de: 'Golf', en: 'Golf' },
            { id: 'cricket', de: 'Cricket', en: 'Cricket' },
          ].map((sp) => (
            <button
              key={sp.id}
              type="button"
              onClick={() => setSportSubFilter(sp.id)}
              className={`sport-pill ${sportSubFilter === sp.id ? 'active' : ''}`}
            >
              {isDe ? sp.de : sp.en}
            </button>
          ))}
        </div>
      )}

      {/* Feed List */}
      <div className="liveticker-feed">
        {loading && items.length === 0 ? (
          <div className="liveticker-empty">{isDe ? 'Lade Meldungenâ€¦' : 'Loading live updatesâ€¦'}</div>
        ) : orderedItems.length === 0 ? (
          <div className="liveticker-empty">{isDe ? 'Keine Meldungen fÃ¼r diesen Filter vorhanden.' : 'No items match this filter.'}</div>
        ) : (
          orderedItems.map((item) => {
            const timeStr = item.time ? new Date(item.time).toLocaleTimeString(isDe ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
            const isLiveBadge = item.badge === 'LIVE' || item.badge === 'EILMELDUNG';

            const content = (
              <div className={`liveticker-entry ${isLiveBadge ? 'is-live' : ''}`}>
                <div className="liveticker-entry-time">
                  <span className="time-val">{timeStr}</span>
                  {item.source && <span className="source-tag">{item.source}</span>}
                </div>
                <div className="liveticker-entry-body">
                  <div className="liveticker-entry-header">
                    <span className={`liveticker-badge ${isLiveBadge ? 'badge-live' : 'badge-desk'}`}>
                      {isLiveBadge ? 'â— ' : ''}{item.badge}
                    </span>
                    <h3 className="liveticker-entry-title">{item.title}</h3>
                  </div>
                  {item.detail && <p className="liveticker-entry-detail">{item.detail}</p>}
                </div>
              </div>
            );

            if (item.slug) {
              return (
                <Link key={item.id} href={`/${locale}/a/${item.slug}`} className="liveticker-entry-link">
                  {content}
                </Link>
              );
            }
            if (item.url) {
              return (
                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="liveticker-entry-link">
                  {content}
                </a>
              );
            }
            return <div key={item.id}>{content}</div>;
          })
        )}
      </div>
    </div>
  );
}
