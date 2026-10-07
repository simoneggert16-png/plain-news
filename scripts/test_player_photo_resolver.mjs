async function resolvePhoto(playerName) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(playerName + ' football')}&gsrlimit=1&prop=pageimages&pithumbsize=300&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'PlainBot/1.0 (news@plain-news.ch)' } });
    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages || {};
      const first = Object.values(pages)[0];
      if (first?.thumbnail?.source) {
        return { source: 'wikipedia', url: first.thumbnail.source };
      }
    }
  } catch (e) {}
  return null;
}

async function test() {
  const testPlayers = [
    'Lionel Messi',
    'Rodrigo De Paul',
    'Cristian Romero',
    'Luc Omore',
    'Marcel Dandjinou',
    'Julián Álvarez',
    'Aiyegun Tosin',
    'Mohamed Tijani',
    'Erling Haaland',
    'Kylian Mbappé',
    'Vinícius Júnior'
  ];

  for (const p of testPlayers) {
    const res = await resolvePhoto(p);
    console.log(p, '->', res ? res.url : 'Not found via Wiki');
  }
}

test();
