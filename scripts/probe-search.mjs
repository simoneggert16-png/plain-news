// Which research backends answer from a CI runner?
//
// The desk runs on GitHub Actions, so from a datacenter address. Most search
// engines answer a browser from a home connection and refuse a runner. This
// script asks every candidate the same question and prints what came back, so
// the desk is wired to the ones that actually work from where it runs.
//
// Run: node scripts/probe-search.mjs "some search words"

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const query = String(process.argv[2] || 'activision itaewon crowd crush footage').trim();
const q = encodeURIComponent(query);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { headers = {}, timeout = 20000, method = 'GET', body } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', ...headers },
      redirect: 'follow',
      body,
      signal: AbortSignal.timeout(timeout),
    });
    const text = method === 'HEAD' ? '' : await res.text().catch(() => '');
    return { status: res.status, body: text, ms: Date.now() - started };
  } catch (err) {
    return { status: 0, body: '', ms: Date.now() - started, error: err.message };
  }
}

const count = (body, re) => (body.match(re) || []).length;

// A page that asks the reader to prove they are human. "challenge" alone is
// too eager: plenty of honest pages use the word.
const BLOCKED = /captcha|are you a robot|unusual traffic|checking your browser|enable javascript and cookies|security check|not a robot|verifying you are human/i;

const CANDIDATES = [
  {
    id: 'google-news-rss',
    what: 'news index (Google News RSS, en-US)',
    url: `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
    hits: (b) => count(b, /<item>/g),
  },
  {
    id: 'google-news-rss-de',
    what: 'news index (Google News RSS, de-DE)',
    url: `https://news.google.com/rss/search?q=${q}&hl=de&gl=DE&ceid=DE:de`,
    hits: (b) => count(b, /<item>/g),
  },
  {
    id: 'bing-news-rss',
    what: 'news index (Bing News RSS)',
    url: `https://www.bing.com/news/search?q=${q}&format=RSS&setlang=en&cc=us`,
    hits: (b) => count(b, /<item>/g),
  },
  {
    id: 'gdelt',
    what: 'world news index (GDELT DOC 2.0)',
    url: `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=10&format=json&sort=datedesc`,
    hits: (b) => count(b, /"url"/g),
  },
  {
    id: 'mwmbl',
    what: 'web index (Mwmbl)',
    url: `https://api.mwmbl.org/search?s=${q}`,
    hits: (b) => count(b, /"url"/g),
  },
  {
    id: 'stract',
    what: 'web index (Stract)',
    url: `https://stract.com/beta/api/search?q=${q}`,
    hits: (b) => count(b, /"url"/g),
  },
  {
    id: 'duckduckgo-html',
    what: 'web index (DuckDuckGo HTML)',
    url: `https://html.duckduckgo.com/html/?q=${q}`,
    hits: (b) => count(b, /class="result__a"/g),
  },
  {
    id: 'mojeek-html',
    what: 'web index (Mojeek HTML)',
    url: `https://www.mojeek.com/search?q=${q}`,
    hits: (b) => count(b, /class="ob"/g),
  },
  {
    id: 'searx-inetol',
    what: 'web index (SearXNG inetol)',
    url: `https://search.inetol.net/search?q=${q}&format=json`,
    hits: (b) => count(b, /"url"/g),
  },
  {
    id: 'marginalia',
    what: 'web index (Marginalia)',
    url: `https://search.marginalia.nu/search?query=${q}`,
    hits: (b) => count(b, /search-result|result-title/g),
  },
  {
    id: 'federal-register',
    what: 'documents (US Federal Register)',
    url: `https://www.federalregister.gov/api/v1/documents.json?per_page=5&order=newest&conditions%5Bterm%5D=${q}`,
    hits: (b) => count(b, /"document_number"/g),
  },
  {
    id: 'sec-edgar',
    what: 'filings (SEC EDGAR full text)',
    url: `https://efts.sec.gov/LATEST/search-index?q=${q}`,
    headers: { 'user-agent': 'PLAIN. news desk research desk@plain-news.ch' },
    hits: (b) => count(b, /"_source"/g),
  },
  {
    id: 'usaspending',
    what: 'contracts (USAspending, keyword)',
    url: 'https://api.usaspending.gov/api/v2/search/spending_by_award/',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      filters: {
        time_period: [{ start_date: '2020-01-01', end_date: '2026-10-31' }],
        award_type_codes: ['A', 'B', 'C', 'D'],
        keywords: [query],
      },
      fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description'],
      page: 1,
      limit: 5,
      subawards: false,
    }),
    hits: (b) => count(b, /"Award ID"/g),
  },
  {
    id: 'defillama-hacks',
    what: 'crypto losses (DeFiLlama hack list)',
    url: 'https://api.llama.fi/hacks',
    hits: (b) => count(b, /"name"/g),
  },
  {
    id: 'courtlistener',
    what: 'cases (CourtListener - needs a token?)',
    url: `https://www.courtlistener.com/api/rest/v4/search/?q=${q}&type=r`,
    hits: (b) => count(b, /"absolute_url"/g),
  },
  {
    id: 'uk-sanctions',
    what: 'sanctions (UK Sanctions List)',
    url: 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.html',
    hits: (b) => count(b, /Name|id="name"/gi),
  },
  {
    id: 'opensanctions',
    what: 'sanctions (OpenSanctions - needs a key?)',
    url: `https://api.opensanctions.org/search/default?q=${q}&limit=5`,
    hits: (b) => count(b, /"schema"/g),
  },
  {
    id: 'wikipedia',
    what: 'encyclopedia (Wikipedia API)',
    url: `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=${q}`,
    hits: (b) => count(b, /"title"/g),
  },
  {
    id: 'wikidata',
    what: 'entities (Wikidata API)',
    url: `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent('SELECT ?item WHERE { ?item rdfs:label ?l . FILTER(CONTAINS(LCASE(?l), "activision")) } LIMIT 5')}`,
    hits: (b) => count(b, /"bindings"/g),
  },
  {
    id: 'openalex',
    what: 'papers (OpenAlex)',
    url: `https://api.openalex.org/works?per-page=5&search=${q}&mailto=desk@plain-news.ch`,
    hits: (b) => count(b, /"display_name"/g),
  },
  {
    id: 'crossref',
    what: 'papers (Crossref)',
    url: `https://api.crossref.org/works?rows=5&query=${q}`,
    hits: (b) => count(b, /"title":/g),
  },
  {
    id: 'jina-reader',
    what: 'page reader (r.jina.ai)',
    url: `https://r.jina.ai/${encodeURIComponent('https://example.com')}`,
    hits: (b) => (b.trim().length > 120 ? 1 : 0),
  },
  {
    id: 'wayback',
    what: 'archive (Wayback CDX)',
    url: 'https://web.archive.org/cdx/search/cdx?url=justice.gov&output=json&limit=5',
    hits: (b) => count(b, /\["/g),
  },
];

const results = [];
for (const c of CANDIDATES) {
  const res = await get(c.url, {
    headers: c.headers,
    method: c.method,
    body: c.body,
    timeout: c.method === 'POST' ? 30000 : 20000,
  });
  let hits = 0;
  try {
    hits = c.hits(res.body || '');
  } catch {
    hits = 0;
  }
  const blocked = BLOCKED.test(res.body || '');
  const good = res.status === 200 && hits > 0 && !blocked;
  results.push({ id: c.id, what: c.what, status: res.status, hits, ms: res.ms, blocked, error: res.error || '' });
  process.stdout.write(
    `${good ? 'OK  ' : 'NO  '} ${c.id.padEnd(18)} ${String(res.status).padEnd(4)} ${String(hits).padStart(4)} hit(s) ${String(res.ms).padStart(6)}ms${blocked ? ' [anti-bot page]' : ''}${res.error ? ` [${res.error}]` : ''}\n`
  );
  // The free engines do not like to be asked at once.
  await wait(1200);
}

const ok = results.filter((r) => r.status === 200 && r.hits > 0 && !r.blocked);
process.stdout.write(`\n${ok.length}/${results.length} answered with hits:\n`);
for (const r of ok) process.stdout.write(`  ${r.id} - ${r.what}\n`);
