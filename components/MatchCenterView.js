'use client';

import { useState, useEffect, useCallback } from 'react';

export default function MatchCenterView({ matchId = '401921408', locale = 'de' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lineups'); // 'lineups' | 'stats' | 'timeline'
  const [selectedTeam, setSelectedTeam] = useState('home'); // 'home' | 'away'
  const [countdown, setCountdown] = useState(15);

  const isDe = locale === 'de';

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/sport/match/${matchId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Match fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
    const interval = setInterval(() => {
      fetchMatch();
      setCountdown(15);
    }, 15000);

    const timer = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : 15));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [fetchMatch]);

  if (loading && !data) {
    return (
      <div className="match-center-card loading">
        <div className="match-center-loading-text">
          <span className="live-dot" /> {isDe ? 'Lade Match Center & SofaScore-Daten…' : 'Loading Match Center & Live Data…'}
        </div>
      </div>
    );
  }

  if (!data || !data.header) {
    return null;
  }

  const { header, stats, lineups, events, commentary, attribution } = data;
  const currentRoster = selectedTeam === 'home' ? lineups.home : lineups.away;
  const currentTeamName = selectedTeam === 'home' ? header.homeTeam.name : header.awayTeam.name;

  return (
    <div className="match-center-card">
      {/* ── 1. MATCH HEADER & SCOREBOARD ── */}
      <div className="match-center-header">
        <div className="match-center-badge-row">
          <span className="match-live-tag">
            <span className="live-dot-pulse" /> {header.status}
          </span>
          <span className="match-competition-tag">{header.name}</span>
          <span className="match-auto-refresh">
            {isDe ? `Live-Update in ${countdown}s` : `Refreshing in ${countdown}s`}
          </span>
        </div>

        <div className="match-score-board">
          <div className="match-team home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={header.homeTeam.logo} alt={header.homeTeam.name} className="match-team-logo" />
            <div className="match-team-name">{header.homeTeam.name}</div>
          </div>

          <div className="match-score-display">
            <div className="match-score-digits">
              {header.homeTeam.score} : {header.awayTeam.score}
            </div>
            <div className="match-time-label">{header.clock || header.status}</div>
          </div>

          <div className="match-team away">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={header.awayTeam.logo} alt={header.awayTeam.name} className="match-team-logo" />
            <div className="match-team-name">{header.awayTeam.name}</div>
          </div>
        </div>

        <div className="match-venue-row">
          <span>📍 {header.venue}</span>
          <span>•</span>
          <span className="match-note-highlight">{header.note}</span>
        </div>
      </div>

      {/* ── 2. SOFASCORE TABS NAVIGATION ── */}
      <div className="match-nav-tabs">
        <button
          type="button"
          className={`match-tab-btn ${activeTab === 'lineups' ? 'active' : ''}`}
          onClick={() => setActiveTab('lineups')}
        >
          {isDe ? 'Aufstellungen & Ratings' : 'Lineups & Ratings'}
        </button>
        <button
          type="button"
          className={`match-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          {isDe ? 'Statistiken' : 'Match Statistics'}
        </button>
        <button
          type="button"
          className={`match-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          {isDe ? 'Liveticker & Highlights' : 'Live Timeline'}
        </button>
      </div>

      {/* ── 3. TAB: LINEUPS & SOFASCORE RATINGS ── */}
      {activeTab === 'lineups' && (
        <div className="match-tab-content">
          <div className="team-selector-switch">
            <button
              type="button"
              className={`team-pill ${selectedTeam === 'home' ? 'active' : ''}`}
              onClick={() => setSelectedTeam('home')}
            >
              {header.homeTeam.name} (Startelf)
            </button>
            <button
              type="button"
              className={`team-pill ${selectedTeam === 'away' ? 'active' : ''}`}
              onClick={() => setSelectedTeam('away')}
            >
              {header.awayTeam.name} (Startelf)
            </button>
          </div>

          <div className="lineup-table-wrap">
            <div className="lineup-section-heading">
              <span>STARTELF · {currentTeamName.toUpperCase()}</span>
              <span className="rating-legend">SOFASCORE-RATING (1.0–10.0)</span>
            </div>

            <div className="players-list">
              {currentRoster.starters.map((player) => (
                <div key={player.id || player.name} className="player-row">
                  <div className="player-left">
                    <span className="player-jersey">{player.jersey}</span>
                    {player.headshot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={player.headshot} alt={player.name} className="player-photo" />
                    ) : (
                      <div className="player-photo-placeholder">{player.name.charAt(0)}</div>
                    )}
                    <div className="player-meta">
                      <div className="player-name">
                        {player.name}
                        {player.isCaptain && <span className="captain-badge">C</span>}
                      </div>
                      <div className="player-pos">{player.position}</div>
                    </div>
                  </div>

                  <div className="player-right">
                    {player.stats?.SOG > 0 && (
                      <span className="player-stat-tag">🎯 {player.stats.SOG} Schüsse aufs Tor</span>
                    )}
                    {player.stats?.G > 0 && (
                      <span className="player-stat-tag goal">⚽ {player.stats.G} Tor</span>
                    )}
                    <span
                      className="player-rating-badge"
                      style={{ backgroundColor: player.ratingColor }}
                    >
                      {player.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {currentRoster.bench.length > 0 && (
              <>
                <div className="lineup-section-heading bench">
                  <span>ERSATZBANK · {currentTeamName.toUpperCase()}</span>
                </div>
                <div className="players-list bench">
                  {currentRoster.bench.map((player) => (
                    <div key={player.id || player.name} className="player-row bench">
                      <div className="player-left">
                        <span className="player-jersey">{player.jersey}</span>
                        <div className="player-meta">
                          <span className="player-name">{player.name}</span>
                          <span className="player-pos">{player.position}</span>
                        </div>
                      </div>
                      <div className="player-right">
                        <span className="player-rating-badge sub">-</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 4. TAB: STATS COMPARISON BARS ── */}
      {activeTab === 'stats' && (
        <div className="match-tab-content stats-tab">
          <div className="stats-teams-legend">
            <span className="stat-team-left">{header.homeTeam.name}</span>
            <span className="stat-team-title">SPIEL-STATISTIKEN</span>
            <span className="stat-team-right">{header.awayTeam.name}</span>
          </div>

          <div className="stats-bars-container">
            {stats.map((st, i) => {
              const total = (st.homeRaw || 0) + (st.awayRaw || 0) || 1;
              const homePct = Math.round(((st.homeRaw || 0) / total) * 100);
              const awayPct = 100 - homePct;

              return (
                <div key={i} className="stat-bar-item">
                  <div className="stat-values-row">
                    <span className="val-left">{st.home}</span>
                    <span className="label-center">{st.label}</span>
                    <span className="val-right">{st.away}</span>
                  </div>
                  <div className="stat-progress-track">
                    <div className="stat-progress-home" style={{ width: `${homePct}%` }} />
                    <div className="stat-progress-away" style={{ width: `${awayPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. TAB: TIMELINE & LIVETICKER ── */}
      {activeTab === 'timeline' && (
        <div className="match-tab-content timeline-tab">
          <div className="timeline-list">
            {commentary.length > 0 ? (
              commentary.map((c, i) => (
                <div key={i} className={`timeline-entry ${c.isKey ? 'highlight' : ''}`}>
                  <div className="timeline-clock">{c.clock || 'LIVE'}</div>
                  <div className="timeline-content">
                    <p>{c.text}</p>
                  </div>
                </div>
              ))
            ) : (
              events.map((e, i) => (
                <div key={i} className="timeline-entry">
                  <div className="timeline-clock">{e.clock || '•'}</div>
                  <div className="timeline-content">
                    <strong>{e.type}</strong>
                    <p>{e.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 6. TRANSPARENCY ATTRIBUTION ── */}
      <div className="match-center-footer">
        <p className="attribution-note">
          ℹ️ {attribution}
        </p>
      </div>
    </div>
  );
}
