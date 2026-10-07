/**
 * Plain News Dynamic Opta / SofaScore Rating Algorithm
 * Interprets real-time in-game statistics into authentic performance ratings (1.0 - 10.0).
 */

export function calculateDynamicRating(stats = {}, position = 'M', isGoalkeeper = false) {
  // Base rating for active participation
  let rating = 6.4;

  const goals = Number(stats.totalGoals || stats.goals || 0);
  const assists = Number(stats.goalAssists || stats.assists || 0);
  const sog = Number(stats.shotsOnTarget || stats.sog || 0);
  const shots = Number(stats.totalShots || stats.shots || 0);
  const keyPasses = Number(stats.keyPasses || 0);
  const passes = Number(stats.passes || 0);
  const passPct = parseFloat(stats.passPct || stats.passCompletion || '80');
  const tackles = Number(stats.tackles || 0);
  const duelsWon = Number(stats.duelsWon || stats.aerialsWon || 0);
  const interceptions = Number(stats.interceptions || 0);
  const clearances = Number(stats.clearances || 0);
  const saves = Number(stats.saves || 0);
  const foulsSuffered = Number(stats.foulsSuffered || 0);
  const foulsCommitted = Number(stats.foulsCommitted || stats.fouls || 0);
  const yellowCards = Number(stats.yellowCards || 0);
  const redCards = Number(stats.redCards || 0);
  const goalsConceded = Number(stats.goalsConceded || 0);

  // 1. Attacking contribution
  rating += goals * 1.0;
  rating += assists * 0.6;
  rating += sog * 0.25;
  rating += Math.max(0, shots - sog) * 0.05;
  rating += keyPasses * 0.25;
  rating += foulsSuffered * 0.1;

  // 2. Passing precision
  if (passes > 15) {
    if (passPct >= 95) rating += 0.4;
    else if (passPct >= 90) rating += 0.25;
    else if (passPct >= 85) rating += 0.1;
    else if (passPct < 70) rating -= 0.25;
  }

  // 3. Defensive stability & duels
  rating += tackles * 0.18;
  rating += interceptions * 0.15;
  rating += clearances * 0.08;
  rating += duelsWon * 0.08;

  // 4. Discipline & deductions
  rating -= foulsCommitted * 0.12;
  rating -= yellowCards * 0.6;
  rating -= redCards * 2.5;

  // 5. Goalkeeper metrics
  if (isGoalkeeper) {
    rating += saves * 0.35;
    rating -= goalsConceded * 0.4;
  }

  // Mathematical clamping between 5.5 and 9.8
  const clamped = Math.max(5.8, Math.min(9.8, Math.round(rating * 10) / 10));
  return clamped;
}

export function getRatingColor(rating) {
  if (rating >= 7.5) return '#1b5e20'; // Dark green (Man of Match / Elite)
  if (rating >= 7.0) return '#2e7d32'; // Green (Very good)
  if (rating >= 6.7) return '#689f38'; // Light green (Solid / Above average)
  if (rating >= 6.4) return '#f57f17'; // Amber (Average)
  return '#e65100'; // Orange / Red (Underperforming)
}
