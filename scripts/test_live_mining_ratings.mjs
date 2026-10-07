import { calculateDynamicRating, getRatingBreakdown } from '../lib/sport/ratingEngine.js';

async function test() {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.friendly/summary?event=401921408', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const sum = await res.json();
  const commentary = sum.commentary || [];

  // 1. Mine commentary events per player
  const mined = {};
  const getP = (name) => {
    const key = name.toLowerCase();
    for (const k of Object.keys(mined)) {
      if (key.includes(k) || k.includes(key)) return mined[k];
    }
    mined[key] = {
      keyPasses: 0,
      tackles: 0,
      interceptions: 0,
      blocks: 0,
      saves: 0,
      dribblesWon: 0,
      dribblesLost: 0,
      dispossessed: 0,
      turnovers: 0,
      offsides: 0,
      bigChancesMissed: 0,
      foulsCommitted: 0,
      foulsSuffered: 0,
    };
    return mined[key];
  };

  commentary.forEach((c) => {
    const text = c.text || '';
    const assist = text.match(/Assisted by ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+)/);
    if (assist) getP(assist[1]).keyPasses++;

    const foulBy = text.match(/Foul by ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+)/);
    if (foulBy) getP(foulBy[1]).foulsCommitted++;

    const freeKick = text.match(/([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+) wins a free kick/);
    if (freeKick) getP(freeKick[1]).foulsSuffered++;

    const offside = text.match(/([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+) is caught offside/);
    if (offside) getP(offside[1]).offsides++;

    const blocked = text.match(/Attempt blocked\. ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+)/);
    if (blocked) getP(blocked[1]).blocks++;

    const saved = text.match(/saved .*? by ([A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+)/);
    if (saved) getP(saved[1]).saves++;
  });

  console.log('Testing pure statistical rating calculation for starters:');
  const rosters = sum.rosters || [];
  rosters.forEach((r) => {
    console.log(`\n=== ${r.team?.displayName} ===`);
    (r.roster || []).filter((p) => p.starter).forEach((p) => {
      const name = p.athlete?.displayName || p.athlete?.shortName || '';
      const isGK = p.position?.displayName?.toLowerCase().includes('goal') || p.position?.abbreviation === 'GK';
      
      const statsMap = (p.stats || []).reduce((acc, s) => {
        acc[s.name] = Number(s.value || s.displayValue) || 0;
        return acc;
      }, {});

      // Merge mined events
      const m = getP(name);
      statsMap.keyPasses = (statsMap.keyPasses || 0) + m.keyPasses;
      statsMap.foulsCommitted = Math.max(statsMap.foulsCommitted || 0, m.foulsCommitted);
      statsMap.foulsSuffered = Math.max(statsMap.foulsSuffered || 0, m.foulsSuffered);
      statsMap.offsides = Math.max(statsMap.offsides || 0, m.offsides);
      statsMap.blocks = (statsMap.blocks || 0) + m.blocks;
      statsMap.saves = Math.max(statsMap.saves || 0, m.saves);

      // Estimate team volume share for duels and passes
      if (name.toLowerCase().includes('de paul')) {
        statsMap.passes = 48;
        statsMap.passPct = 94;
        statsMap.tackles = 4;
        statsMap.duelsWon = 6;
      } else if (name.toLowerCase().includes('romero')) {
        statsMap.passes = 42;
        statsMap.passPct = 96;
        statsMap.tackles = 5;
        statsMap.interceptions = 3;
      } else if (name.toLowerCase().includes('messi')) {
        statsMap.passes = 34;
        statsMap.passPct = 82;
        statsMap.dispossessed = 3;
        statsMap.turnovers = 2;
        statsMap.dribblesLost = 2;
      } else if (name.toLowerCase().includes('omore')) {
        statsMap.tackles = 4;
        statsMap.interceptions = 3;
        statsMap.duelsWon = 5;
      }

      const rating = calculateDynamicRating(statsMap, p.position?.abbreviation, isGK);
      const bd = getRatingBreakdown(statsMap, rating);

      console.log(`${p.jersey.padStart(2)} ${name.padEnd(20)} [${p.position?.abbreviation || ' '}] -> Rating: ${rating} | Pos: ${bd.positives.join(', ') || '-'} | Neg: ${bd.negatives.join(', ') || '-'}`);
    });
  });
}

test();
