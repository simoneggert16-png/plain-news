'use client';

import { useState, useEffect, useCallback } from 'react';
import TacticalPitchCanvas from './TacticalPitchCanvas';

export default function MatchCenterView({ matchId = '401921408', locale = 'de' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lineups'); // 'lineups' | 'stats' | 'timeline'
  const [lineupSubView, setLineupSubView] = useState('pitch'); // 'pitch' | 'list'
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
          <span className="live-dot" /> {isDe ? 'Lade Spieldaten, Aufstellung & Spielstand…' : 'Loading Match Center & Live Score…'}
        </div>
      </div>
    );
  }

  if (!data || !data.header) {
    return null;
  }

  const { header, goals = [], assisters = [], stats = [], lineups, events = [], commentary = [], attribution } = data;
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

        {/* ── TORSCHÜTZEN & VORLAGEN BANNER ── */}
        {goals.length > 0 && (
          <div className="match-scorers-bar">
            <div className="scorers-title">{isDe ? 'TORE & VORLAGEN' : 'GOALS & ASSISTS'}</div>
            <div className="scorers-list">
              {goals.map((g, i) => (
                <div key={i} className="scorer-item">
                  <span className="scorer-icon">⚽</span>
                  <span className="scorer-minute">{g.clock}</span>
                  <strong className="scorer-name">{g.scorer}</strong>
                  {g.assist && (
                    <span className="scorer-assist">
                      (👟 Vorlage: {g.assist})
                    </span>
                  )}
                  <span className="scorer-team">({g.teamName})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="match-venue-row">
          <span>📍 {header.venue}</span>
          <span>•</span>
          <span className="match-note-highlight">{header.note}</span>
        </div>
      </div>

      {/* ── 2. NAVIGATION TABS (PURE FACTS) ── */}
      <div className="match-nav-tabs">
        <button
          type="button"
          className={`match-tab-btn ${activeTab === 'lineups' ? 'active' : ''}`}
          onClick={() => setActiveTab('lineups')}
        >
          {isDe ? '🏟️ Aufstellung & Formation' : '🏟️ Lineup & Formation'}
        </button>
        <button
          type="button"
          className={`match-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          {isDe ? '📊 Spiel-Statistiken' : '📊 Match Statistics'}
        </button>
        <button
          type="button"
          className={`match-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          {isDe ? '⚡ Liveticker & Highlights' : '⚡ Live Timeline'}
        </button>
      </div>

      {/* ── 3. TAB: LINEUPS & DYNAMIC PITCH ── */}
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
                🏟️ {isDe ? 'Taktisches Spielfeld' : 'Tactical Pitch'}
              </button>
              <button
                type="button"
                className={`lineup-toggle-btn ${lineupSubView === 'list' ? 'active' : ''}`}
                onClick={() => setLineupSubView('list')}
              >
                📋 {isDe ? 'Kader & Aufstellung' : 'Squad & Lineup'}
              </button>
            </div>
          </div>

          {/* ── 3A. DYNAMIC TACTICAL PITCH VIEW ── */}
          {lineupSubView === 'pitch' && (
            <div className="tactical-pitch-section">
              <div className="pitch-teams-banner">
                <div className="pitch-team-left">
                  <span className="pitch-team-name">{header.homeTeam.name}</span>
                  <span className="pitch-sys-badge">{header.homeTeam.formation}</span>
                  <span className="pitch-coach-name">({header.homeTeam.coach})</span>
                </div>
                <div className="pitch-center-vs">VS</div>
                <div className="pitch-team-right">
                  <span className="pitch-coach-name">({header.awayTeam.coach})</span>
                  <span className="pitch-sys-badge">{header.awayTeam.formation}</span>
                  <span className="pitch-team-name">{header.awayTeam.name}</span>
                </div>
              </div>

              {/* Dynamic Vector Pitch Canvas with Goals & Assists */}
              <div className="tactical-pitch-container">
                <TacticalPitchCanvas
                  homeTeam={header.homeTeam}
                  awayTeam={header.awayTeam}
                  homePlayers={lineups.home.starters}
                  awayPlayers={lineups.away.starters}
                />
              </div>

              {/* Key Playmakers & Scorers Bar */}
              {(goals.length > 0 || assisters.length > 0) && (
                <div className="top-performers-showcase">
                  <div className="performer-heading">
                    {isDe ? 'MATCH-HIGHLIGHTS & SCORER' : 'MATCH HIGHLIGHTS & SCORERS'}
                  </div>
                  <div className="performer-cards-grid">
                    {goals.map((g, idx) => (
                      <div key={`g-${idx}`} className="performer-card">
                        <div className="performer-icon-badge">⚽</div>
                        <div className="performer-info">
                          <div className="performer-name">{g.scorer}</div>
                          <div className="performer-role">Tor in Minute {g.clock} ({g.teamName})</div>
                        </div>
                      </div>
                    ))}
                    {assisters.map((a, idx) => (
                      <div key={`a-${idx}`} className="performer-card">
                        <div className="performer-icon-badge assist">👟</div>
                        <div className="performer-info">
                          <div className="performer-name">{a.name}</div>
                          <div className="performer-role">{a.assists} {a.assists === 1 ? 'Torvorlage' : 'Torvorlagen'}</div>
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
                  {header.homeTeam.name} (Startelf · {header.homeTeam.formation})
                </button>
                <button
                  type="button"
                  className={`team-pill ${selectedTeam === 'away' ? 'active' : ''}`}
                  onClick={() => setSelectedTeam('away')}
                >
                  {header.awayTeam.name} (Startelf · {header.awayTeam.formation})
                </button>
              </div>

              <div className="lineup-section-heading">
                <span>STARTELF · {currentTeamName.toUpperCase()}</span>
                <span className="rating-legend">POSITION & MATCH-AKTIONEN</span>
              </div>

              <div className="players-list">
                {currentRoster.starters.map((player) => (
                  <div key={player.id || player.name} className="player-row">
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
                        </div>
                        <div className="player-pos">{player.position || player.posAbbr}</div>
                      </div>
                    </div>

                    <div className="player-right">
                      {player.goals > 0 && (
                        <span className="player-stat-tag goal">⚽ {player.goals} {player.goals === 1 ? 'Tor' : 'Tore'}</span>
                      )}
                      {player.assists > 0 && (
                        <span className="player-stat-tag assist">👟 {player.assists} {player.assists === 1 ? 'Vorlage' : 'Vorlagen'}</span>
                      )}
                      {player.card && (
                        <span className="player-stat-tag card">
                          {player.card.isRed ? '🟥' : '🟨'} {player.card.clock}
                        </span>
                      )}
                      {player.sub?.replacedBy && (
                        <span className="player-stat-tag sub">🔄 {player.sub.clock}</span>
                      )}
                      {player.stats?.shotsOnTarget > 0 && (
                        <span className="player-stat-tag">🎯 {player.stats.shotsOnTarget} Torschüsse</span>
                      )}
                      {player.stats?.saves > 0 && (
                        <span className="player-stat-tag">🧤 {player.stats.saves} Paraden</span>
                      )}
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
                            <span className="player-pos">{player.position || player.posAbbr}</span>
                          </div>
                        </div>
                        <div className="player-right">
                          {player.goals > 0 && (
                            <span className="player-stat-tag goal">⚽ {player.goals} Tor</span>
                          )}
                          {player.sub?.replaces && (
                            <span className="player-stat-tag sub">🔄 Eingewechselt ({player.sub.clock})</span>
                          )}
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
