/**
 * Plain News Dynamic Opta / SofaScore Rating Algorithm
 * Comprehensive mathematical matrix interpreting 25+ real-time match events
 * into authentic player performance ratings (1.0 - 10.0).
 */

export function calculateDynamicRating(stats = {}, posAbbr = 'M', isGoalkeeper = false) {
  // Base starting score for an active starter (6.5 standard baseline)
  let rating = 6.5;

  const pos = (posAbbr || '').toUpperCase();
  const isDefender = pos.includes('D') || pos.includes('CB') || pos.includes('LB') || pos.includes('RB') || pos.includes('IV') || pos.includes('V');
  const isForward = pos.includes('F') || pos.includes('FW') || pos.includes('ST') || pos.includes('CF') || pos.includes('W') || pos.includes('S');
  const isMidfielder = !isGoalkeeper && !isDefender && !isForward;

  // ── 1. ATTACKING & FINISHING ──
  const goals = Number(stats.totalGoals || stats.goals || 0);
  const assists = Number(stats.goalAssists || stats.assists || 0);
  const sog = Number(stats.shotsOnTarget || stats.sog || 0);
  const shots = Number(stats.totalShots || stats.shots || 0);
  const shotsOffTarget = Math.max(0, shots - sog);
  const bigChancesCreated = Number(stats.bigChancesCreated || 0);
  const bigChancesMissed = Number(stats.bigChancesMissed || 0);
  const penaltiesWon = Number(stats.penaltiesWon || 0);

  rating += goals * (isDefender ? 0.90 : isMidfielder ? 0.75 : 0.70);
  rating += assists * 0.45;
  rating += bigChancesCreated * 0.30;
  rating += sog * 0.15;
  rating += shotsOffTarget * 0.02;
  rating += penaltiesWon * 0.45;
  rating -= bigChancesMissed * 0.40;

  // ── 2. BALL RETENTION, DRIBBLES & TURNOVERS (BALLVERLUSTE) ──
  const successfulDribbles = Number(stats.dribblesWon || stats.takeOnsWon || stats.successfulDribbles || 0);
  const unsuccessfulDribbles = Number(stats.dribblesLost || stats.unsuccessfulDribbles || 0);
  const dispossessed = Number(stats.dispossessed || 0);
  const turnovers = Number(stats.turnovers || stats.badTouches || 0);
  const foulsSuffered = Number(stats.foulsSuffered || 0);
  const offsides = Number(stats.offsides || 0);

  rating += successfulDribbles * 0.15;
  rating += foulsSuffered * 0.08;

  // Real penalties for squandering possession
  rating -= unsuccessfulDribbles * 0.18;
  rating -= dispossessed * 0.22;
  rating -= turnovers * 0.15;
  rating -= offsides * 0.15;

  // ── 3. PASSING & CHANCE CREATION ──
  const keyPasses = Number(stats.keyPasses || stats.chancesCreated || 0);
  const passes = Number(stats.passes || 0);
  const passPct = parseFloat(stats.passPct || stats.passCompletion || (passes > 0 ? '85' : '0'));
  const accurateCrosses = Number(stats.accurateCrosses || 0);
  const inaccurateCrosses = Number(stats.inaccurateCrosses || 0);

  rating += keyPasses * 0.20;
  rating += accurateCrosses * 0.12;
  rating -= inaccurateCrosses * 0.05;

  if (passes >= 15) {
    if (passPct >= 95) rating += 0.25;
    else if (passPct >= 90) rating += 0.15;
    else if (passPct >= 85) rating += 0.05;
    else if (passPct < 70) rating -= 0.20;
    else if (passPct < 60) rating -= 0.40;
  }

  // ── 4. DEFENSIVE SOLIDITY & DUELS ──
  const tackles = Number(stats.tackles || stats.tacklesWon || 0);
  const interceptions = Number(stats.interceptions || 0);
  const clearances = Number(stats.clearances || 0);
  const blocks = Number(stats.blocks || stats.shotsBlocked || 0);
  const aerialDuelsWon = Number(stats.aerialsWon || stats.aerialDuelsWon || 0);
  const aerialDuelsLost = Number(stats.aerialsLost || 0);
  const groundDuelsWon = Number(stats.groundDuelsWon || stats.duelsWon || 0);
  const groundDuelsLost = Number(stats.groundDuelsLost || 0);
  const goalLineClearances = Number(stats.goalLineClearances || 0);

  rating += tackles * (isDefender ? 0.15 : 0.12);
  rating += interceptions * 0.14;
  rating += blocks * 0.16;
  rating += clearances * 0.06;
  rating += aerialDuelsWon * 0.10;
  rating += groundDuelsWon * 0.08;
  rating += goalLineClearances * 0.60;

  rating -= aerialDuelsLost * 0.08;
  rating -= groundDuelsLost * 0.08;

  // ── 5. DISCIPLINE & SEVERE ERRORS ──
  const foulsCommitted = Number(stats.foulsCommitted || stats.fouls || 0);
  const yellowCards = Number(stats.yellowCards || 0);
  const redCards = Number(stats.redCards || 0);
  const ownGoals = Number(stats.ownGoals || 0);
  const penaltyConceded = Number(stats.penaltyConceded || stats.penaltiesConceded || 0);
  const errorLeadingToShot = Number(stats.errorLeadingToShot || 0);
  const errorLeadingToGoal = Number(stats.errorLeadingToGoal || 0);

  rating -= foulsCommitted * 0.14;
  rating -= yellowCards * 0.60;
  rating -= redCards * 2.50;
  rating -= ownGoals * 1.50;
  rating -= penaltyConceded * 0.95;
  rating -= errorLeadingToShot * 0.70;
  rating -= errorLeadingToGoal * 1.30;

  // ── 6. GOALKEEPER & DEFENSIVE LINE METRICS ──
  const goalsConceded = Number(stats.goalsConceded || 0);
  const saves = Number(stats.saves || 0);
  const savesInsideBox = Number(stats.savesInsideBox || 0);
  const penaltiesSaved = Number(stats.penaltiesSaved || 0);
  const highClaims = Number(stats.highClaims || 0);

  if (isGoalkeeper) {
    rating += saves * 0.35;
    rating += savesInsideBox * 0.45;
    rating += highClaims * 0.25;
    rating += penaltiesSaved * 1.30;
    rating -= goalsConceded * 0.40;

    // Clean sheet bonus for goalkeepers
    if (goalsConceded === 0 && (stats.minutesPlayed || 90) >= 60) {
      rating += 0.30;
    }
  } else if (isDefender) {
    // Defenders are penalized for team goals conceded
    rating -= goalsConceded * 0.20;
    if (goalsConceded === 0 && (stats.minutesPlayed || 90) >= 60) {
      rating += 0.20;
    }
  }

  // ── 7. MATHEMATICAL CLAMPING & PRECISION ──
  // Clamped between 2.0 (abysmal disaster) and 9.9 (generational masterclass)
  const clamped = Math.max(2.0, Math.min(9.9, Math.round(rating * 10) / 10));
  return clamped;
}

/**
 * Returns SofaScore / Opta official color band for a given rating.
 */
export function getRatingColor(rating) {
  const r = Number(rating);
  if (r >= 7.5) return '#1b5e20'; // Elite / Man of the Match (Dark Green)
  if (r >= 7.0) return '#2e7d32'; // Very Good (Green)
  if (r >= 6.7) return '#689f38'; // Solid / Above Average (Light Green)
  if (r >= 6.4) return '#f57f17'; // Average / Passable (Amber)
  if (r >= 5.8) return '#e65100'; // Mediocre / Underperforming (Orange)
  return '#c62828';             // Poor / Costly Errors (Red)
}

/**
 * Generates an analytical breakdown explaining why the player received this rating.
 */
export function getRatingBreakdown(stats = {}, rating = 6.5) {
  const positives = [];
  const negatives = [];

  if (stats.totalGoals > 0) positives.push(`${stats.totalGoals} Tor${stats.totalGoals > 1 ? 'e' : ''}`);
  if (stats.goalAssists > 0) positives.push(`${stats.goalAssists} Assist`);
  if (stats.keyPasses > 0) positives.push(`${stats.keyPasses} Torschussvorlagen`);
  if (stats.tackles >= 3) positives.push(`${stats.tackles} gewonnene Zweikämpfe`);
  if (stats.interceptions >= 3) positives.push(`${stats.interceptions} Bälle abgefangen`);
  if (stats.saves >= 3) positives.push(`${stats.saves} Paraden`);
  if (stats.dribblesWon >= 2) positives.push(`${stats.dribblesWon} erfolgreiche Dribblings`);
  if (parseFloat(stats.passPct) >= 92) positives.push(`${stats.passPct} Passquote`);

  if (stats.dispossessed >= 2) negatives.push(`${stats.dispossessed} Ballverluste durch Tacklings`);
  if (stats.dribblesLost >= 2) negatives.push(`${stats.dribblesLost} hängengebliebene Dribblings`);
  if (stats.bigChancesMissed > 0) negatives.push(`${stats.bigChancesMissed} Großchance vergeben`);
  if (stats.foulsCommitted >= 3) negatives.push(`${stats.foulsCommitted} Fouls begangen`);
  if (stats.yellowCards > 0) negatives.push('Gelbe Karte');
  if (stats.errorLeadingToShot > 0) negatives.push('Fehler vor Torschuss');

  return {
    rating: Number(rating).toFixed(1),
    color: getRatingColor(rating),
    positives,
    negatives,
  };
}
