'use client';

import { useState } from 'react';

/**
 * Parses formation string like "4-3-3" or "4-2-3-1" into array of counts including GK:
 * "4-3-3" -> [1, 4, 3, 3]
 * "4-2-3-1" -> [1, 4, 2, 3, 1]
 */
function parseFormationLines(formationStr = '4-3-3') {
  const parts = formationStr.split(/[-–]/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
  if (parts.length === 0) return [1, 4, 4, 2];
  return [1, ...parts];
}

/**
 * Calculates (x, y) coordinates for all 11 players of a team on a 1000 x 640 pitch.
 * isHome: true = left-to-right (attacking right), false = right-to-left (attacking left)
 */
function calculatePlayerPositions(players = [], formationStr = '4-3-3', isHome = true) {
  const lines = parseFormationLines(formationStr);
  const numLines = lines.length;
  const W = 1000;
  const H = 640;

  const startX = isHome ? 60 : 940;
  const endX = isHome ? 440 : 560;

  const positions = [];
  let playerIdx = 0;

  lines.forEach((count, lineIdx) => {
    const xFraction = numLines === 1 ? 0 : lineIdx / (numLines - 1);
    const x = Math.round(startX + (endX - startX) * xFraction);

    for (let i = 0; i < count; i++) {
      let y;
      if (count === 1) {
        y = H / 2;
      } else {
        const topMargin = 70;
        const bottomMargin = 570;
        y = Math.round(topMargin + ((bottomMargin - topMargin) / (count - 1)) * i);
      }

      const player = players[playerIdx] || {
        name: `Spieler ${playerIdx + 1}`,
        jersey: `${playerIdx + 1}`,
      };

      positions.push({
        ...player,
        x,
        y,
        isHome,
      });

      playerIdx++;
    }
  });

  return positions;
}

export default function TacticalPitchCanvas({
  homeTeam = {},
  awayTeam = {},
  homePlayers = [],
  awayPlayers = [],
  onSelectPlayer = null,
}) {
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);

  const homePositions = calculatePlayerPositions(homePlayers, homeTeam.formation || '4-3-3', true);
  const awayPositions = calculatePlayerPositions(awayPlayers, awayTeam.formation || '4-2-3-1', false);
  const allPositions = [...homePositions, ...awayPositions];

  const handlePlayerClick = (p) => {
    setActivePlayer(activePlayer?.name === p.name ? null : p);
    if (onSelectPlayer) onSelectPlayer(p);
  };

  return (
    <div className="dynamic-pitch-wrapper">
      {/* ── 1. SVG Dynamic Soccer Pitch Canvas ── */}
      <svg
        viewBox="0 0 1000 640"
        className="dynamic-pitch-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Pitch Field Gradient */}
          <linearGradient id="pitchGrass" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e252a" />
            <stop offset="50%" stopColor="#192025" />
            <stop offset="100%" stopColor="#1e252a" />
          </linearGradient>

          {/* Player Disc Shadow */}
          <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* ── Pitch Turf ── */}
        <rect x="0" y="0" width="1000" height="640" fill="url(#pitchGrass)" rx="8" />

        {/* ── Outer Boundary ── */}
        <rect
          x="20"
          y="20"
          width="960"
          height="600"
          fill="none"
          stroke="#3d4952"
          strokeWidth="2.5"
        />

        {/* ── Halfway Line ── */}
        <line x1="500" y1="20" x2="500" y2="620" stroke="#3d4952" strokeWidth="2.5" />

        {/* ── Center Circle & Spot ── */}
        <circle cx="500" cy="320" r="85" fill="none" stroke="#3d4952" strokeWidth="2" />
        <circle cx="500" cy="320" r="4" fill="#3d4952" />

        {/* ── Left Penalty Area (Home) ── */}
        <rect x="20" y="150" width="150" height="340" fill="none" stroke="#3d4952" strokeWidth="2" />
        <rect x="20" y="235" width="55" height="170" fill="none" stroke="#3d4952" strokeWidth="2" />
        <circle cx="125" cy="320" r="3.5" fill="#3d4952" />
        <path d="M 170 265 A 75 75 0 0 1 170 375" fill="none" stroke="#3d4952" strokeWidth="2" />

        {/* ── Right Penalty Area (Away) ── */}
        <rect x="830" y="150" width="150" height="340" fill="none" stroke="#3d4952" strokeWidth="2" />
        <rect x="925" y="235" width="55" height="170" fill="none" stroke="#3d4952" strokeWidth="2" />
        <circle cx="875" cy="320" r="3.5" fill="#3d4952" />
        <path d="M 830 265 A 75 75 0 0 0 830 375" fill="none" stroke="#3d4952" strokeWidth="2" />

        {/* ── Corner Arcs ── */}
        <path d="M 20 40 A 20 20 0 0 0 40 20" fill="none" stroke="#3d4952" strokeWidth="2" />
        <path d="M 20 600 A 20 20 0 0 1 40 620" fill="none" stroke="#3d4952" strokeWidth="2" />
        <path d="M 980 40 A 20 20 0 0 1 960 20" fill="none" stroke="#3d4952" strokeWidth="2" />
        <path d="M 980 600 A 20 20 0 0 0 960 620" fill="none" stroke="#3d4952" strokeWidth="2" />

        {/* ── 2. Dynamic Player Nodes (Pure Match Facts: Goals, Assists, Cards) ── */}
        {allPositions.map((p, idx) => {
          const isSelected = activePlayer?.name === p.name;
          const isHovered = hoveredPlayer?.name === p.name;
          const radius = 24;

          return (
            <g
              key={p.id || p.name || idx}
              transform={`translate(${p.x}, ${p.y})`}
              className="pitch-player-node"
              onClick={() => handlePlayerClick(p)}
              onMouseEnter={() => setHoveredPlayer(p)}
              onMouseLeave={() => setHoveredPlayer(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Highlight Halo */}
              {(isSelected || isHovered) && (
                <circle
                  cx="0"
                  cy="0"
                  r={radius + 6}
                  fill="none"
                  stroke={p.isHome ? '#75AADB' : '#008751'}
                  strokeWidth="3"
                  strokeDasharray="4 2"
                />
              )}

              {/* Player Circular Disc */}
              <circle
                cx="0"
                cy="0"
                r={radius}
                fill="#ffffff"
                stroke={isSelected ? '#ffffff' : p.isHome ? '#75AADB' : '#008751'}
                strokeWidth={2}
                filter="url(#nodeShadow)"
              />

              {/* Clip Path for Headshot */}
              <clipPath id={`clip-${idx}`}>
                <circle cx="0" cy="0" r={radius - 1} />
              </clipPath>

              {/* Player Image or Initials Fallback */}
              {p.headshot ? (
                <image
                  href={p.headshot}
                  x={-radius}
                  y={-radius}
                  width={radius * 2}
                  height={radius * 2}
                  clipPath={`url(#clip-${idx})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text
                  x="0"
                  y="6"
                  textAnchor="middle"
                  fill="#111111"
                  fontSize="14"
                  fontWeight="bold"
                  fontFamily="system-ui, sans-serif"
                >
                  {p.name ? p.name.charAt(0) : p.jersey}
                </text>
              )}

              {/* Goalscorer Badge (⚽) */}
              {p.goals > 0 && (
                <g transform="translate(14, -14)">
                  <circle cx="0" cy="0" r="10" fill="#1b5e20" stroke="#ffffff" strokeWidth="1.5" />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="11"
                    fontFamily="sans-serif"
                  >
                    ⚽
                  </text>
                </g>
              )}

              {/* Assister Badge (👟) */}
              {p.assists > 0 && !p.goals && (
                <g transform="translate(14, -14)">
                  <circle cx="0" cy="0" r="10" fill="#0277bd" stroke="#ffffff" strokeWidth="1.5" />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="11"
                    fontFamily="sans-serif"
                  >
                    👟
                  </text>
                </g>
              )}

              {/* Yellow / Red Card Badge */}
              {p.card && (
                <g transform={`translate(-18, -14)`}>
                  <rect
                    x="-4"
                    y="-6"
                    width="8"
                    height="12"
                    rx="1.5"
                    fill={p.card.isRed ? '#c62828' : '#ffd600'}
                    stroke="#111"
                    strokeWidth="0.8"
                  />
                </g>
              )}

              {/* Player Jersey Number Tag Badge */}
              <g transform="translate(0, 16)">
                <rect
                  x="-12"
                  y="-7"
                  width="24"
                  height="14"
                  rx="3"
                  fill="#111827"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="900"
                  fontFamily="'SF Mono', Menlo, monospace"
                >
                  {p.jersey}
                </text>
              </g>

              {/* Player Name Tag (Underneath circle) */}
              <text
                x="0"
                y={radius + 18}
                textAnchor="middle"
                fill="#f3f4f6"
                fontSize="12"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
                filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.9))"
              >
                {p.shortName || p.name}
              </text>

              {/* Captain Indicator */}
              {p.isCaptain && (
                <g transform={`translate(-${radius + 4}, 0)`}>
                  <circle cx="0" cy="0" r="7" fill="#f57f17" stroke="#ffffff" strokeWidth="1" />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="900"
                    fontFamily="monospace"
                  >
                    C
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── 3. Interactive Player Stat Drawer / Inspection Card ── */}
      {(activePlayer || hoveredPlayer) && (
        <div className="dynamic-player-drawer">
          {(() => {
            const cur = activePlayer || hoveredPlayer;
            return (
              <div className="drawer-card">
                <div className="drawer-left">
                  {cur.headshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cur.headshot} alt={cur.name} className="drawer-photo" />
                  ) : (
                    <div className="drawer-photo-placeholder">{cur.name?.charAt(0)}</div>
                  )}
                  <div className="drawer-meta">
                    <div className="drawer-title">
                      #{cur.jersey} {cur.name} {cur.isCaptain && <span className="drawer-c">C</span>}
                    </div>
                    <div className="drawer-sub">
                      {cur.position || cur.posAbbr} · {cur.isHome ? homeTeam.name : awayTeam.name}
                    </div>
                  </div>
                </div>

                <div className="drawer-stats">
                  {cur.goals > 0 && (
                    <span className="drawer-chip goal">⚽ {cur.goals} {cur.goals === 1 ? 'Tor' : 'Tore'}</span>
                  )}
                  {cur.assists > 0 && (
                    <span className="drawer-chip assist">👟 {cur.assists} {cur.assists === 1 ? 'Vorlage' : 'Vorlagen'}</span>
                  )}
                  {cur.card && (
                    <span className="drawer-chip card">
                      {cur.card.isRed ? '🟥 Rote Karte' : '🟨 Gelbe Karte'} ({cur.card.clock})
                    </span>
                  )}
                  {cur.sub?.replacedBy && (
                    <span className="drawer-chip sub">🔄 Ausgewechselt ({cur.sub.clock})</span>
                  )}
                  {cur.sub?.replaces && (
                    <span className="drawer-chip sub">🔄 Eingewechselt ({cur.sub.clock})</span>
                  )}
                  {cur.stats?.shotsOnTarget > 0 && (
                    <span className="drawer-chip">🎯 {cur.stats.shotsOnTarget} Schüsse aufs Tor</span>
                  )}
                  {cur.stats?.saves > 0 && (
                    <span className="drawer-chip">🧤 {cur.stats.saves} Paraden</span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
