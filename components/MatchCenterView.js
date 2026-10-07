'use client';

import { useState, useEffect, useCallback } from 'react';

const RATING_LEGEND = [
  { label: '≥ 7.5 Hervorragend', color: '#1b5e20' },
  { label: '7.0–7.4 Sehr gut', color: '#2e7d32' },
  { label: '6.7–6.9 Gut', color: '#689f38' },
  { label: '6.5–6.6 Solide', color: '#f57f17' },
  { label: '< 6.5 Ausbaufähig', color: '#e65100' },
];

export default function MatchCenterView({ matchId = '401921408', locale = 'de' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lineups'); // 'lineups' | 'stats' | 'timeline'
  const [lineupSubView, setLineupSubView] = useState('pitch'); // 'pitch' | 'list'
  const [selectedTeam, setSelectedTeam] = useState('home'); // 'home' | 'away'
  const [inspectedPlayer, setInspectedPlayer] = useState(null);
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
          <span className="live-dot" /> {isDe ? 'Lade SofaScore Match Center & Aufstellungsgrafik…' : 'Loading SofaScore Match Center & Tactical Pitch…'}
        </div>
      </div>
    );
  }

  if (!data || !data.header) {
    return null;
  }

  const { header, stats, tacticalPitch, lineups, events, commentary, attribution } = data;
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
            <div className="match-formation-meta">
              {header.homeTeam.formation} · {header.homeTeam.coach}
            </div>
          </div>

          <div className="match-score-display">
            <div className="match-score-digits">
              {header.homeTeam.score} : {header.awayTeam.score}
            </div>
            <div className="match-time-label">{header.clock || header.status}</div>
            <div className="match-rating-comp">
              Ø {header.homeTeam.avgRating} vs Ø {header.awayTeam.avgRating}
            </div>
          </div>

          <div className="match-team away">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={header.awayTeam.logo} alt={header.awayTeam.name} className="match-team-logo" />
            <div className="match-team-name">{header.awayTeam.name}</div>
            <div className="match-formation-meta">
              {header.awayTeam.formation} · {header.awayTeam.coach}
            </div>
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
          {isDe ? '🏟️ Aufstellung & SofaScore-Ratings' : '🏟️ Lineup & SofaScore Ratings'}
        </button>
        <button
          type="button"
          className={`match-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          {isDe ? '📊 Match-Statistiken' : '📊 Match Statistics'}
        </button>
        <button
          type="button"
          className={`match-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          {isDe ? '⚡ Liveticker & Highlights' : '⚡ Live Timeline'}
        </button>
      </div>

      {/* ── 3. TAB: LINEUPS & RATINGS ── */}
      {activeTab === 'lineups' && (
        <div className="match-tab-content">
          {/* Sub-View Switcher: Pitch Graphic vs Detailed List */}
          <div className="lineup-view-toggle-bar">
            <div className="lineup-sub-buttons">
              <button
                type="button"
                className={`lineup-toggle-btn ${lineupSubView === 'pitch' ? 'active' : ''}`}
                onClick={() => setLineupSubView('pitch')}
              >
                🏟️ {isDe ? 'Taktische Grafik (Spielfeld)' : 'Tactical Pitch Graphic'}
              </button>
              <button
                type="button"
                className={`lineup-toggle-btn ${lineupSubView === 'list' ? 'active' : ''}`}
                onClick={() => setLineupSubView('list')}
              >
                📋 {isDe ? 'Detaillierte Spielerbewertungen' : 'Detailed Player Ratings'}
              </button>
            </div>

            <div className="rating-legend-compact">
              {RATING_LEGEND.map((l, i) => (
                <span key={i} className="legend-chip">
                  <span className="legend-dot" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* ── 3A. TACTICAL PITCH GRAPHIC VIEW (PRIMARY) ── */}
          {lineupSubView === 'pitch' && (
            <div className="tactical-pitch-section">
              <div className="pitch-teams-banner">
                <div className="pitch-team-left">
                  <span className="pitch-flag">🇦🇷</span>
                  <span className="pitch-team-name">{header.homeTeam.name}</span>
                  <span className="pitch-sys-badge">{header.homeTeam.formation}</span>
                  <span className="pitch-coach-name">({header.homeTeam.coach})</span>
                </div>
                <div className="pitch-center-vs">VS</div>
                <div className="pitch-team-right">
                  <span className="pitch-coach-name">({header.awayTeam.coach})</span>
                  <span className="pitch-sys-badge">{header.awayTeam.formation}</span>
                  <span className="pitch-team-name">{header.awayTeam.name}</span>
                  <span className="pitch-flag">🇧🇯</span>
                </div>
              </div>

              {/* The Visual Soccer Pitch Container */}
              <div className="tactical-pitch-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tacticalPitch?.image || '/sport/argentina_benin_pitch.png'}
                  alt="Taktische Aufstellung Argentinien vs. Benin SofaScore"
                  className="tactical-pitch-image"
                />
              </div>

              {/* Top Performer Highlights Bar */}
              {tacticalPitch?.topPerformers && (
                <div className="top-performers-showcase">
                  <div className="performer-heading">
                    {isDe ? 'SCHLÜSSELAKTEURE & SOFASCORE RATINGS' : 'KEY PERFORMERS & SOFASCORE RATINGS'}
                  </div>
                  <div className="performer-cards-grid">
                    {tacticalPitch.topPerformers.map((p, idx) => (
                      <div key={idx} className="performer-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.photo} alt={p.name} className="performer-photo" />
                        <div className="performer-info">
                          <div className="performer-name">{p.name}</div>
                          <div className="performer-role">{p.role}</div>
                        </div>
                        <div
                          className="performer-rating-pill"
                          style={{
                            backgroundColor:
                              p.rating >= 7.5
                                ? '#1b5e20'
                                : p.rating >= 7.0
                                ? '#2e7d32'
                                : p.rating >= 6.7
                                ? '#689f38'
                                : '#e65100',
                          }}
                        >
                          {p.rating.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 3B. DETAILED PLAYERS LIST VIEW ── */}
          {lineupSubView === 'list' && (
            <div className="lineup-table-wrap">
              <div className="team-selector-switch">
                <button
                  type="button"
                  className={`team-pill ${selectedTeam === 'home' ? 'active' : ''}`}
                  onClick={() => setSelectedTeam('home')}
                >
                  🇦🇷 {header.homeTeam.name} (Startelf · {header.homeTeam.formation})
                </button>
                <button
                  type="button"
                  className={`team-pill ${selectedTeam === 'away' ? 'active' : ''}`}
                  onClick={() => setSelectedTeam('away')}
                >
                  🇧🇯 {header.awayTeam.name} (Startelf · {header.awayTeam.formation})
                </button>
              </div>

              <div className="lineup-section-heading">
                <span>STARTELF · {currentTeamName.toUpperCase()}</span>
                <span className="rating-legend">SOFASCORE RATINGS (OPTA LIVE METRICS)</span>
              </div>

              <div className="players-list">
                {currentRoster.starters.map((player) => (
                  <div
                    key={player.id || player.name}
                    className={`player-row ${inspectedPlayer?.name === player.name ? 'selected' : ''}`}
                    onClick={() => setInspectedPlayer(player === inspectedPlayer ? null : player)}
                  >
                    <div className="player-left">
                      <span className="player-jersey">{player.jersey}</span>
                      {player.headshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.headshot}
                          alt={player.name}
                          className="player-photo"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="player-photo-placeholder">{player.name.charAt(0)}</div>
                      )}
                      <div className="player-meta">
                        <div className="player-name">
                          {player.name}
                          {player.isCaptain && <span className="captain-badge">C</span>}
                          {player.isMotm && <span className="motm-badge">MOTM</span>}
                        </div>
                        <div className="player-pos">{player.position}</div>
                      </div>
                    </div>

                    <div className="player-right">
                      {player.stats?.passPct && (
                        <span className="player-stat-tag">👟 {player.stats.passPct} Passquote</span>
                      )}
                      {player.stats?.tackles && (
                        <span className="player-stat-tag">🛡️ {player.stats.tackles} Tackles</span>
                      )}
                      {player.stats?.keyPasses && (
                        <span className="player-stat-tag">🎯 {player.stats.keyPasses} Torschussvorlagen</span>
                      )}
                      {player.stats?.saves && (
                        <span className="player-stat-tag">🧤 {player.stats.saves} Paraden</span>
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
                          {player.headshot ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={player.headshot} alt={player.name} className="player-photo-sub" />
                          ) : (
                            <div className="player-photo-placeholder sub">{player.name.charAt(0)}</div>
                          )}
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
          )}
        </div>
      )}

      {/* ── 4. TAB: STATS COMPARISON BARS ── */}
      {activeTab === 'stats' && (
        <div className="match-tab-content stats-tab">
          <div className="stats-teams-legend">
            <span className="stat-team-left">🇦🇷 {header.homeTeam.name}</span>
            <span className="stat-team-title">SPIEL-STATISTIKEN (OPTA)</span>
            <span className="stat-team-right">🇧🇯 {header.awayTeam.name}</span>
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
