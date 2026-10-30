// The desk's filing cabinets.
//
// A reporter does not only read the news — they know where the documents are
// filed. These are the public, keyless doors into those filing cabinets:
// the US Justice Department's press releases, the UN's newsroom, the World
// Bank's procurement notices, the whole world's news archive in GDELT.
// The desk can therefore file a primary document without a paid search engine.

const UA = 'Mozilla/5.0 (compatible; PlainNewsBot/1.0; +https://plain-news.ch)';

const STOP = new Set(['that', 'this', 'with', 'from', 'have', 'were', 'been', 'will', 'about', 'after', 'over', 'into', 'says', 'said', 'their', 'under', 'more', 'what', 'when', 'where', 'which', 'while', 'there', 'these', 'those', 'should', 'would', 'could', 'und', 'oder', 'aber', 'nicht', 'auch', 'für', 'mit', 'von', 'der', 'die', 'das', 'dem', 'den', 'des', 'ein', 'eine']);

const stripTags = (s = '') =>
  String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

async function grab(url, { type = 'json', timeout = 12000 } = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: type === 'json' ? 'application/json' : 'application/rss+xml,application/xml,text/xml,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return type === 'json' ? res.json() : res.text();
}

const termsOf = (query) =>
  [...new Set(String(query || '').toLowerCase().replace(/[^a-z0-9äöüßÀ-ÿ ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)))];

const matches = (text, terms) => {
  const t = String(text || '').toLowerCase();
  return terms.length ? terms.some((x) => t.includes(x)) : false;
};

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
};

/** Items of an RSS feed: title, link, date, description. */
function rssItems(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const pick = (tag) => {
      const x = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return x ? stripTags(x[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')) : '';
    };
    const link = (body.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '';
    out.push({
      title: pick('title'),
      url: pick('link') || link.trim(),
      publishedAt: pick('pubDate') || pick('dc:date') || null,
      summary: pick('description').slice(0, 300),
    });
  }
  return out;
}

/** GDELT: the whole world's news archive, 100+ languages, real publisher links. */
async function gdelt(query, { limit = 12, timespan = '90d' } = {}) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=${Math.min(50, limit)}&timespan=${timespan}&sort=datedesc`;
  let data = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      data = await grab(url);
      break;
    } catch (err) {
      // GDELT allows one request every five seconds.
      if (/429/.test(err.message) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 5500));
        continue;
      }
      return [];
    }
  }
  const list = Array.isArray(data?.articles) ? data.articles : [];
  return list.map((a) => ({
    title: String(a.title || '').slice(0, 300),
    url: a.url,
    outlet: a.domain || hostOf(a.url),
    publishedAt: a.seendate || null,
    summary: '',
    kind: 'news',
    primary: false,
    lang: a.language || '',
  }));
}

/** The US Justice Department: indictments, sentences, plea agreements. */
async function dojPress(query) {
  const terms = termsOf(query);
  const xml = await grab('https://www.justice.gov/news/rss?type=press_release', { type: 'xml' });
  return rssItems(xml)
    .filter((i) => i.url && matches(`${i.title} ${i.summary}`, terms))
    .slice(0, 10)
    .map((i) => ({ ...i, outlet: 'US Department of Justice', kind: 'document', primary: true }));
}

/** The UN newsroom: reports, statements, resolutions in the open. */
async function unNews(query) {
  const terms = termsOf(query);
  const xml = await grab('https://news.un.org/feed/subscribe/en/news/all/rss.xml', { type: 'xml' });
  return rssItems(xml)
    .filter((i) => i.url && matches(`${i.title} ${i.summary}`, terms))
    .slice(0, 10)
    .map((i) => ({ ...i, outlet: 'UN News', kind: 'document', primary: true }));
}

/** US Treasury: sanctions and designations. */
async function treasuryPress(query) {
  const terms = termsOf(query);
  const feeds = [
    ['US Treasury', 'https://home.treasury.gov/news/press-releases/rss'],
    ['US Treasury', 'https://home.treasury.gov/rss/press-releases.xml'],
  ];
  for (const [outlet, url] of feeds) {
    try {
      const xml = await grab(url, { type: 'xml', timeout: 9000 });
      const items = rssItems(xml).filter((i) => i.url && matches(`${i.title} ${i.summary}`, terms));
      if (items.length) return items.slice(0, 10).map((i) => ({ ...i, outlet, kind: 'document', primary: true }));
    } catch {
      /* try the next feed */
    }
  }
  return [];
}

/** World Bank procurement notices: tenders, awards, contracts. */
async function worldBank(query) {
  const terms = termsOf(query);
  const url = `https://search.worldbank.org/api/v2/procnotices?format=json&qterm=${encodeURIComponent(terms.join(' '))}&rows=15`;
  const data = await grab(url);
  const list = Array.isArray(data?.procnotices) ? data.procnotices : [];
  return list.map((n) => ({
    title: `${n.notice_type || 'Notice'}: ${n.title || n.description || ''}`.slice(0, 300),
    url: `https://contracts.worldbank.org/ViewContractNotice/${n.id}`,
    outlet: 'World Bank procurement',
    publishedAt: n.posted_on || null,
    summary: String(n.description || '').slice(0, 300),
    kind: 'document',
    primary: true,
  }));
}

/** Background on the people and institutions in the story. */
async function wikipedia(query) {
  const terms = termsOf(query);
  if (!terms.length) return [];
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(terms.slice(0, 4).join(' '))}&srlimit=5&format=json`;
  const data = await grab(url);
  const list = Array.isArray(data?.query?.search) ? data.query.search : [];
  return list.map((s) => ({
    title: s.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(s.title).replace(/ /g, '_'))}`,
    outlet: 'Wikipedia',
    publishedAt: null,
    summary: String(s.snippet || '').replace(/<[^>]+>/g, '').slice(0, 240),
    kind: 'background',
    primary: false,
  }));
}

const CABINETS = [
  ['doj', dojPress, 'US Justice Department'],
  ['un', unNews, 'UN newsroom'],
  ['treasury', treasuryPress, 'US Treasury'],
  ['worldbank', worldBank, 'World Bank procurement'],
  ['wikipedia', wikipedia, 'background'],
];

/**
 * Everything the filing cabinets hold for this question: primary documents
 * first, then the world archive, then background.
 */
export async function filingCabinets(query, { limit = 14 } = {}) {
  const jobs = [
    ...CABINETS.map(([name, fn, label]) =>
      fn(query)
        .then((hits) => ({ name, label, hits }))
        .catch(() => ({ name, label, hits: [] })),
    ),
    gdelt(query, { limit: 12 })
      .then((hits) => ({ name: 'gdelt', label: 'world archive', hits }))
      .catch(() => ({ name: 'gdelt', label: 'world archive', hits: [] })),
  ];

  const settled = await Promise.all(jobs);
  const out = [];
  const seen = new Set();
  for (const group of settled) {
    for (const hit of group.hits) {
      if (!hit.url || seen.has(hit.url)) continue;
      seen.add(hit.url);
      out.push(hit);
    }
  }
  // Documents first: a story needs the papers, not only the headlines.
  out.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
  return out.slice(0, limit);
}
