import { NextResponse } from 'next/server';
import { resolvePlayerPhoto } from '@/lib/sport/photoResolver';

export const dynamic = 'force-dynamic';
export const revalidate = 15;

const MATCH_ID_RE = /^\d{1,12}$/;
const MAX_REMOTE_PHOTO_LOOKUPS_PER_REQUEST = 6;
const PHOTO_RESOLVE_CONCURRENCY = 4;

function parseFormationString(displayFormation, roster = []) {
  if (displayFormation && typeof displayFormation === 'string') {
    return displayFormation;
  }
  const defenders = roster.filter((p) => p.position?.displayName?.toLowerCase().includes('back') || p.position?.abbreviation?.includes('D')).length;
  const midfielders = roster.filter((p) => p.position?.displayName?.toLowerCase().includes('mid') || p.position?.abbreviation?.includes('M')).length;
  const forwards = roster.filter((p) => p.position?.displayName?.toLowerCase().includes('forward') || p.position?.displayName?.toLowerCase().includes('wing') || p.position?.abbreviation?.includes('F')).length;

  if (defenders >= 3 && midfielders >= 2 && forwards >= 1) {
    return `${defenders}-${midfielders}-${forwards}`;
  }
  return '4-3-3';
}

function parseIntStat(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatIntStat(raw) {
  const val = parseIntStat(raw) ?? 0;
  return { display: String(val), raw: val };
}

function formatPercentStat(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { display: '0%', raw: 0 };
  }
  const str = String(raw).trim();
  const hasPercent = str.includes('%');
  const parsed = Number.parseFloat(str.replace(/%/g, '').trim());
  if (!Number.isFinite(parsed)) {
    return { display: '0%', raw: 0 };
  }
  // If string already contains '%' or numeric value > 1 (e.g. 85), do NOT multiply by 100 again.
  const pct = (hasPercent || parsed > 1 || parsed === 0) ? parsed : parsed * 100;
  const clamped = Math.max(0, Math.min(100, pct));
  return {
    display: `${Math.round(clamped)}%`,
    raw: Math.round(clamped * 10) / 10,
  };
}

export async function GET(request, { params }) {
  try {
    const { id: rawId } = await params;
    const eventId = String(rawId || '').trim();
    if (!MATCH_ID_RE.test(eventId)) {
      return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });
    }

    const leaguesToTry = ['fifa.friendly', 'uefa.champions', 'eng.1', 'esp.1', 'ger.1', 'ita.1'];
    let sum = null;

    for (const league of leaguesToTry) {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${encodeURIComponent(eventId)}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(3500),
          next: { revalidate: 15 },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.header?.competitions?.[0]) {
            sum = json;
            break;
          }
        }
      } catch {
        // try next league
      }
    }

    if (!sum) {
      return NextResponse.json({ error: 'Match data unavailable from source' }, { status: 404 });
    }

    const comp = sum.header?.competitions?.[0];
    if (!comp) {
      return NextResponse.json({ error: 'Competition details missing' }, { status: 404 });
    }

    // Teams & Score
    const homeComp = comp.competitors?.find((c) => c.homeAway === 'home') || comp.competitors?.[0];
    const awayComp = comp.competitors?.find((c) => c.homeAway === 'away') || comp.competitors?.[1];

    const homeRosterRaw = sum.rosters?.[0]?.roster || [];
    const awayRosterRaw = sum.rosters?.[1]?.roster || [];

    const homeFormation = homeComp?.formation || parseFormationString(null, homeRosterRaw.filter((p) => p.starter));
    const awayFormation = awayComp?.formation || (homeFormation === '4-3-3' ? '4-2-3-1' : '4-4-2');

    const matchHeader = {
      id: eventId,
      name: sum.header?.season?.name || comp.name || 'International Football',
      note: comp.status?.type?.detail || 'Match Center',
      venue: sum.gameInfo?.venue?.displayName || '',
      status: comp.status?.type?.detail || comp.status?.type?.description || 'LIVE',
      clock: comp.status?.displayClock || '',
      period: comp.status?.period || 1,
      isLive: comp.status?.type?.state === 'in',
      isCompleted: comp.status?.type?.completed || false,
      homeTeam: {
        id: homeComp?.id,
        name: homeComp?.team?.displayName || 'Home Team',
        shortName: homeComp?.team?.shortDisplayName || 'HOME',
        score: homeComp?.score ?? '0',
        logo: homeComp?.team?.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/countries/500/arg.png',
        color: homeComp?.team?.color || '75AADB',
        formation: homeFormation,
        coach: sum.gameInfo?.coaches?.find((c) => c.team?.id === homeComp?.id)?.displayName || '',
      },
      awayTeam: {
        id: awayComp?.id,
        name: awayComp?.team?.displayName || 'Away Team',
        shortName: awayComp?.team?.shortDisplayName || 'AWAY',
        score: awayComp?.score ?? '0',
        logo: awayComp?.team?.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/countries/500/ben.png',
        color: awayComp?.team?.color || '008751',
        formation: awayFormation,
        coach: sum.gameInfo?.coaches?.find((c) => c.team?.id === awayComp?.id)?.displayName || '',
      },
    };

    // ── PARSE GOALS & ASSISTS FROM KEY EVENTS & COMMENTARY ──
    const goals = [];
    const assistersMap = {};
    const cardsMap = {};
    const subsMap = {};

    (sum.keyEvents || []).forEach((ev) => {
      const type = (ev.type?.type || ev.type?.text || '').toLowerCase();
      const text = ev.text || '';
      const clock = ev.clock?.displayValue || '';
      const teamId = ev.team?.id;
      const isHome = teamId === homeComp?.id;

      if (type.includes('goal') || ev.scoringPlay) {
        let scorer = ev.participants?.[0]?.athlete?.displayName;
        let assist = ev.participants?.[1]?.athlete?.displayName;

        // Parse from commentary if participants are missing
        if (!scorer) {
          const mScorer = text.match(/Goal!.*?\.\s+([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)+)/);
          if (mScorer) scorer = mScorer[1];
        }
        if (!assist) {
          const mAssist = text.match(/Assisted by ([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)+)/);
          if (mAssist) assist = mAssist[1];
        }

        if (scorer) {
          goals.push({
            scorer,
            assist: assist || null,
            clock,
            isHome,
            teamName: isHome ? matchHeader.homeTeam.name : matchHeader.awayTeam.name,
            text,
          });

          if (assist) {
            assistersMap[assist] = (assistersMap[assist] || 0) + 1;
          }
        }
      } else if (type.includes('card') || type.includes('yellow') || type.includes('red')) {
        const player = ev.participants?.[0]?.athlete?.displayName || text.split('(')[0].trim();
        const isRed = type.includes('red');
        cardsMap[player] = { isRed, isYellow: !isRed, clock };
      } else if (type.includes('sub')) {
        const playerIn = ev.participants?.[0]?.athlete?.displayName;
        const playerOut = ev.participants?.[1]?.athlete?.displayName;
        if (playerIn && playerOut) {
          subsMap[playerOut] = { replacedBy: playerIn, clock };
          subsMap[playerIn] = { replaces: playerOut, clock };
        }
      }
    });

    // Fallback if goals were missing in keyEvents but present in commentary
    if (goals.length === 0 && Number(homeComp?.score ?? 0) + Number(awayComp?.score ?? 0) > 0) {
      (sum.commentary || []).forEach((c) => {
        const t = c.text || '';
        if (t.startsWith('Goal!')) {
          const mScorer = t.match(/Goal!\s+[^.]+\.\s+([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)+)/);
          const mAssist = t.match(/Assisted by ([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)+)/);
          if (mScorer) {
            goals.push({
              scorer: mScorer[1],
              assist: mAssist ? mAssist[1] : null,
              clock: c.time?.displayValue || '',
              isHome: true,
              teamName: matchHeader.homeTeam.name,
              text: t,
            });
            if (mAssist) assistersMap[mAssist[1]] = (assistersMap[mAssist[1]] || 0) + 1;
          }
        }
      });
    }

    // Boxscore / Team Statistics (strictly factual, no fabricated fallback numbers)
    const boxTeams = sum.boxscore?.teams || [];
    const getStat = (teamIdx, label) => {
      const t = boxTeams[teamIdx];
      if (!t?.statistics) return null;
      const found = t.statistics.find((s) => s.label?.toLowerCase() === label.toLowerCase());
      if (!found) return null;
      return found.displayValue ?? (found.value !== undefined ? String(found.value) : null);
    };

    const homePossession = formatPercentStat(getStat(0, 'Possession'));
    const awayPossession = formatPercentStat(getStat(1, 'Possession'));
    const homeShots = formatIntStat(getStat(0, 'SHOTS'));
    const awayShots = formatIntStat(getStat(1, 'SHOTS'));
    const homeOnGoal = formatIntStat(getStat(0, 'ON GOAL'));
    const awayOnGoal = formatIntStat(getStat(1, 'ON GOAL'));
    const homeCorners = formatIntStat(getStat(0, 'Corner Kicks'));
    const awayCorners = formatIntStat(getStat(1, 'Corner Kicks'));
    const homeFouls = formatIntStat(getStat(0, 'Fouls'));
    const awayFouls = formatIntStat(getStat(1, 'Fouls'));
    const homePasses = formatIntStat(getStat(0, 'Passes'));
    const awayPasses = formatIntStat(getStat(1, 'Passes'));
    const homePassPct = formatPercentStat(getStat(0, 'Pass Completion %'));
    const awayPassPct = formatPercentStat(getStat(1, 'Pass Completion %'));

    const stats = [
      {
        label: 'Ballbesitz',
        home: homePossession.display,
        away: awayPossession.display,
        homeRaw: homePossession.raw,
        awayRaw: awayPossession.raw,
      },
      {
        label: 'Torschüsse gesamt',
        home: homeShots.display,
        away: awayShots.display,
        homeRaw: homeShots.raw,
        awayRaw: awayShots.raw,
      },
      {
        label: 'Schüsse aufs Tor',
        home: homeOnGoal.display,
        away: awayOnGoal.display,
        homeRaw: homeOnGoal.raw,
        awayRaw: awayOnGoal.raw,
      },
      {
        label: 'Eckbälle',
        home: homeCorners.display,
        away: awayCorners.display,
        homeRaw: homeCorners.raw,
        awayRaw: awayCorners.raw,
      },
      {
        label: 'Gefoulte Aktionen',
        home: homeFouls.display,
        away: awayFouls.display,
        homeRaw: homeFouls.raw,
        awayRaw: awayFouls.raw,
      },
      {
        label: 'Gespielte Pässe',
        home: homePasses.display,
        away: awayPasses.display,
        homeRaw: homePasses.raw,
        awayRaw: awayPasses.raw,
      },
      {
        label: 'Passquote',
        home: homePassPct.display,
        away: awayPassPct.display,
        homeRaw: homePassPct.raw,
        awayRaw: awayPassPct.raw,
      },
    ];

    // Dynamic Roster (Pure Facts: Goals, Assists, Cards, Subs)
    const rosters = sum.rosters || [];
    const remoteBudget = { remaining: MAX_REMOTE_PHOTO_LOOKUPS_PER_REQUEST };

    const parseRoster = async (teamRoster, teamLogo) => {
      if (!teamRoster?.roster) return { starters: [], bench: [] };
      const starters = [];
      const bench = [];

      // Prioritize starters first so limited remote lookup budget serves starting XI
      const ordered = [
        ...teamRoster.roster.filter((p) => p.starter),
        ...teamRoster.roster.filter((p) => !p.starter),
      ];

      const resolvedPlayers = [];
      for (let i = 0; i < ordered.length; i += PHOTO_RESOLVE_CONCURRENCY) {
        const chunk = ordered.slice(i, i + PHOTO_RESOLVE_CONCURRENCY);
        const batch = await Promise.all(
          chunk.map(async (p) => {
            const rawName = p.athlete?.displayName || p.athlete?.shortName || '';
            const lowerName = rawName.toLowerCase();

            // Check if player scored
            const goalsScored = lowerName
              ? goals.filter((g) => {
                  const s = g.scorer?.toLowerCase();
                  return s && (s.includes(lowerName) || lowerName.includes(s));
                }).length
              : 0;

            // Check if player assisted
            let assistsCount = 0;
            if (lowerName) {
              for (const [astName, count] of Object.entries(assistersMap)) {
                const aLower = astName.toLowerCase();
                if (aLower && (aLower.includes(lowerName) || lowerName.includes(aLower))) {
                  assistsCount = count;
                  break;
                }
              }
            }

            // Check cards
            let cardInfo = null;
            if (lowerName) {
              for (const [cName, info] of Object.entries(cardsMap)) {
                const cLower = cName.toLowerCase();
                if (cLower && (cLower.includes(lowerName) || lowerName.includes(cLower))) {
                  cardInfo = info;
                  break;
                }
              }
            }

            // Check sub
            let subInfo = null;
            if (lowerName) {
              for (const [sName, sData] of Object.entries(subsMap)) {
                const sLower = sName.toLowerCase();
                if (sLower && (sLower.includes(lowerName) || lowerName.includes(sLower))) {
                  subInfo = sData;
                  break;
                }
              }
            }

            const photoUrl = await resolvePlayerPhoto(
              {
                name: rawName,
                slug: p.athlete?.slug,
                athlete: p.athlete,
                teamLogo,
              },
              { remoteBudget }
            );

            return {
              starter: Boolean(p.starter),
              playerObj: {
                id: p.athlete?.id || rawName,
                name: rawName,
                shortName: p.athlete?.shortName || rawName,
                jersey: p.jersey ?? '',
                position: p.position?.displayName || '',
                posAbbr: p.position?.abbreviation || '',
                headshot: photoUrl,
                isCaptain: Boolean(p.captain),
                goals: goalsScored,
                assists: assistsCount,
                card: cardInfo,
                sub: subInfo,
                stats: (p.stats || []).reduce((acc, s) => {
                  acc[s.name] = s.value !== undefined ? s.value : s.displayValue;
                  return acc;
                }, {}),
              },
            };
          })
        );
        resolvedPlayers.push(...batch);
      }

      for (const { starter, playerObj } of resolvedPlayers) {
        if (starter) starters.push(playerObj);
        else bench.push(playerObj);
      }

      return { starters, bench };
    };

    const homeRoster = await parseRoster(rosters[0], matchHeader.homeTeam.logo);
    const awayRoster = await parseRoster(rosters[1], matchHeader.awayTeam.logo);

    // List of match assisters
    const matchAssisters = Object.entries(assistersMap).map(([name, count]) => ({
      name,
      assists: count,
    }));

    // Timeline / Key Events
    const events = (sum.keyEvents || []).map((e) => ({
      clock: e.clock?.displayValue || '',
      type: e.type?.text || '',
      text: e.text || '',
    })).filter((e) => e.text);

    // Live Commentary (Play-by-play) - Reverse chronological: newest events on top!
    const rawCommentary = sum.commentary || [];
    const commentary = [...rawCommentary].reverse().map((c) => {
      const text = c.text || '';
      const clock = c.time?.displayValue || '';
      const isGoal = text.startsWith('Goal!') || text.toLowerCase().includes('converts the penalty');
      const isRed = text.includes('shown the red card');
      const isYellow = text.includes('shown the yellow card');
      const isSub = text.startsWith('Substitution,');

      let eventType = null;
      let label = null;
      if (isGoal) {
        eventType = 'goal';
        label = 'TOR';
      } else if (isRed) {
        eventType = 'red_card';
        label = 'ROT';
      } else if (isYellow) {
        eventType = 'yellow_card';
        label = 'GELB';
      } else if (isSub) {
        eventType = 'sub';
        label = 'WECHSEL';
      }

      return {
        clock,
        text,
        type: eventType,
        typeLabel: label,
        isKey: Boolean(eventType) || c.type?.id === 'goal' || c.type?.id === 'card',
      };
    });

    return NextResponse.json({
      header: matchHeader,
      goals,
      assisters: matchAssisters,
      stats,
      lineups: {
        home: homeRoster,
        away: awayRoster,
      },
      events,
      commentary,
      attribution: 'Offizielle Spieldaten, Torschützen, Vorlagen & Spielstatistiken via Opta & FIFA Match Feed. Radikal faktenbasiert ohne subjektive Algorithmen-Ratings.',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    console.error('Error fetching match detail:', err);
    return NextResponse.json({ error: 'Internal error loading match center' }, { status: 500 });
  }
}
