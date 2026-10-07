async function fetchMatch(eventId) {
  const leagues = ['fifa.friendly', 'uefa.champions', 'eng.1', 'esp.1', 'ger.1', 'ita.1'];
  for (const l of leagues) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${l}/summary?event=${eventId}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      console.log(`  ${l}: status ${res.status}`);
      if (res.ok) {
        const json = await res.json();
        if (json.header?.competitions?.[0]) {
          console.log(`  -> Success with league ${l}: ${json.header.season?.name || json.header.competitions[0].name}`);
          return { league: l, data: json };
        }
      }
    } catch (e) {}
  }
  return null;
}

async function run() {
  console.log('Testing Messi match: 401921408');
  await fetchMatch('401921408');
  console.log('Testing CL match: 401915418');
  await fetchMatch('401915418');
}

run();
