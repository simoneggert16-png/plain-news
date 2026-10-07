async function test() {
  const leagues = [
    { code: 'fifa.friendly', label: 'International Friendlies' },
    { code: 'uefa.champions', label: 'UEFA Champions League' },
    { code: 'eng.1', label: 'Premier League' },
    { code: 'esp.1', label: 'La Liga' },
    { code: 'ger.1', label: 'Bundesliga' }
  ];

  for (const l of leagues) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${l.code}/scoreboard`);
      if (res.ok) {
        const data = await res.json();
        const events = data.events || [];
        console.log(`[${l.label}] Found ${events.length} events`);
        if (events.length > 0) {
          const sample = events[0];
          console.log(`  Sample: ID=${sample.id} | ${sample.name} | Status=${sample.status?.type?.detail || sample.status?.type?.description}`);
        }
      } else {
        console.log(`[${l.label}] HTTP ${res.status}`);
      }
    } catch (e) {
      console.error(`[${l.label}] Error:`, e.message);
    }
  }
}

test();
