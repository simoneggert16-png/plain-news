// The desk's filing cabinets.
//
// A reporter does not only read the news — they know where the documents are
// filed. These are the public, keyless doors into those filing cabinets:
// the US Justice Department's press releases, the UN's newsroom, the World
// Bank's procurement notices, the whole world's news archive in GDELT.
// The desk can therefore file a primary document without a paid search engine.

import { namedTerms, BOILERPLATE, INSTITUTIONS, institutionDocuments } from './documents.mjs';

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

// The words of the question that say something about it. "Court", "case" and
// "victims" stand in every press release of every institution, so a question
// that is only made of them cannot tell one release from another.
const termsOf = (query) =>
  [...new Set(String(query || '').toLowerCase().replace(/[^a-z0-9äöüßÀ-ÿ ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w) && !BOILERPLATE.has(w)))];

// The names of the question: what a document has to use to be about it.
const namesOf = (query) => namedTerms(query).filter((n) => !BOILERPLATE.has(n));

// One shared word is not a match: the UN newsroom carries the word "new" in
// every headline, and a cabinet that answers with one word answers with
// everything. Two words, or one when the question has only one. A name of the
// question counts on its own — "Activision" is not a word every release has.
const matches = (text, terms, names = []) => {
  const t = String(text || '').toLowerCase();
  if (!terms.length) return false;
  const needed = Math.min(2, terms.length);
  let hits = 0;
  for (const x of terms) if (t.includes(x)) hits++;
  if (hits >= needed) return true;
  return hits >= 1 && names.some((n) => t.includes(n));
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
async function dojItems() {
  const xml = await grab('https://www.justice.gov/news/rss?type=press_release', { type: 'xml' });
  return rssItems(xml)
    .filter((i) => i.url)
    .slice(0, 12)
    .map((i) => ({ ...i, outlet: 'US Department of Justice', kind: 'document', primary: true }));
}

async function dojPress(query) {
  const terms = termsOf(query);
  const names = namesOf(query);
  const items = await dojItems();
  return items.filter((i) => matches(`${i.title} ${i.summary}`, terms, names)).slice(0, 10);
}

/** The UN newsroom: reports, statements, resolutions in the open. */
async function unItems() {
  const xml = await grab('https://news.un.org/feed/subscribe/en/news/all/rss.xml', { type: 'xml' });
  return rssItems(xml)
    .filter((i) => i.url)
    .slice(0, 12)
    .map((i) => ({ ...i, outlet: 'UN News', kind: 'document', primary: true }));
}

async function unNews(query) {
  const terms = termsOf(query);
  const names = namesOf(query);
  const items = await unItems();
  return items.filter((i) => matches(`${i.title} ${i.summary}`, terms, names)).slice(0, 10);
}

/** US Treasury: sanctions and designations. */
async function treasuryItems() {
  const feeds = [
    ['US Treasury', 'https://home.treasury.gov/news/press-releases/rss'],
    ['US Treasury', 'https://home.treasury.gov/rss/press-releases.xml'],
  ];
  for (const [outlet, url] of feeds) {
    try {
      const xml = await grab(url, { type: 'xml', timeout: 9000 });
      const items = rssItems(xml).filter((i) => i.url).slice(0, 12);
      if (items.length) return items.map((i) => ({ ...i, outlet, kind: 'document', primary: true }));
    } catch {
      /* try the next feed */
    }
  }
  return [];
}

async function treasuryPress(query) {
  const terms = termsOf(query);
  const names = namesOf(query);
  const items = await treasuryItems();
  return items.filter((i) => matches(`${i.title} ${i.summary}`, terms, names)).slice(0, 10);
}

/** World Bank procurement notices: tenders, awards, contracts. */
async function worldBankItems(qterm = 'procurement') {
  const url = `https://search.worldbank.org/api/v2/procnotices?format=json&qterm=${encodeURIComponent(qterm)}&rows=15`;
  const data = await grab(url);
  const list = Array.isArray(data?.procnotices) ? data.procnotices : [];
  // The bank's search ignores the query, so the notice has to carry the
  // words itself. A notice without a title carries nothing.
  return list
    .map((n) => ({
      title: `${n.notice_type || 'Notice'}: ${n.title || n.description || ''}`.slice(0, 300),
      url: `https://contracts.worldbank.org/ViewContractNotice/${n.id}`,
      outlet: 'World Bank procurement',
      publishedAt: n.posted_on || null,
      summary: String(n.description || '').slice(0, 300),
      kind: 'document',
      primary: true,
    }))
    .filter((n) => n.title.replace(/^Notice:\s*/, '').trim().length > 12)
    .slice(0, 12);
}

async function worldBank(query) {
  const terms = termsOf(query);
  const names = namesOf(query);
  if (!terms.length) return [];
  const items = await worldBankItems(terms.join(' '));
  return items.filter((n) => matches(`${n.title} ${n.summary}`, terms, names)).slice(0, 10);
}

/**
 * The front pages of the cabinets, unfiltered. A desk that looks for a story
 * of its own reads what the world's institutions publish today — it does not
 * wait for a tip to tell it where to look.
 *
 * Every cabinet gets its say: the desk reads a few notices from each front
 * page, not the whole of the first one it comes to.
 */
export async function cabinetFrontPage({ limit = 40, perCabinet = 6 } = {}) {
  // One cabinet that is down must not silence the others.
  const registry = INSTITUTIONS.map((inst) =>
    institutionDocuments(inst, { limit: 10 })
      .then((hits) => ({ label: inst.outlet, hits }))
      .catch(() => ({ label: inst.outlet, hits: [] }))
  );
  const groups = await Promise.all([
    dojItems().then((hits) => ({ label: 'US Justice Department', hits })).catch(() => ({ label: 'US Justice Department', hits: [] })),
    unItems().then((hits) => ({ label: 'UN newsroom', hits })).catch(() => ({ label: 'UN newsroom', hits: [] })),
    treasuryItems().then((hits) => ({ label: 'US Treasury', hits })).catch(() => ({ label: 'US Treasury', hits: [] })),
    worldBankItems().then((hits) => ({ label: 'World Bank procurement', hits })).catch(() => ({ label: 'World Bank procurement', hits: [] })),
    ...registry,
  ]);
  const queues = groups.map((g) => (g.hits || []).filter((h) => h?.url).slice(0, perCabinet));
  const out = [];
  const seen = new Set();
  for (let i = 0; i < perCabinet; i++) {
    for (const queue of queues) {
      const hit = queue[i];
      if (!hit || seen.has(hit.url)) continue;
      seen.add(hit.url);
      out.push(hit);
    }
  }
  return out.slice(0, limit);
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
export async function filingCabinets(query, { limit = 14 } = {}) {  const jobs = [
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

// ─────────────────────── published press addresses ───────────────────────
// A desk that wants an answer writes to the address the organisation itself
// publishes. This reads that address off their own pages - it never guesses
// one, and it never collects a pattern like info@ or press@ out of thin air.
const CONTACT_PATHS = [
  '/contact', '/contact-us', '/about/contact', '/about', '/press', '/press-room',
  '/media', '/media-enquiries', '/newsroom', '/company/contact', '/impressum',
  '/kontakt', '/en/contact', '/about-us/contact',
];

const JUNK_MAIL = /^(example|your|name|someone|firstname|lastname|user|test|hello|xxx|abc|foo|bar)@|\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i;

// The endings of a domain. They say nothing about who owns the site.
const SUFFIX = new Set([
  'com', 'org', 'net', 'gov', 'int', 'mil', 'edu', 'info', 'biz', 'io', 'co',
  'uk', 'hk', 'eu', 'de', 'fr', 'jp', 'cn', 'ru', 'ch', 'be', 'at', 'nl',
  'se', 'no', 'fi', 'dk', 'es', 'it', 'br', 'in', 'au', 'ca', 'nz', 'za',
  'kr', 'sg', 'tw', 'th', 'vn', 'id', 'my', 'ph', 'mx', 'ar', 'cl', 'tr',
  'ua', 'pl', 'cz', 'gr', 'pt', 'ie', 'il', 'ae', 'sa',
]);

// The name of a mailbox tells the desk what kind of desk it is: 3 is the
// press desk, 2 the desk that takes every letter, 1 the rest.
const deskScore = (local) => {
  const l = String(local || '').toLowerCase();
  if (/^(press|media|news|newsroom|editorial|editors?|comms?|communications|inquir\w*|media-?inquir\w*)/.test(l)) return 3;
  if (/^(contact|contacts|desk|reach|write|impressum|enquir\w*)/.test(l)) return 2;
  if (/^(info|office|hello|mail|admin|general|team|support|service)/.test(l)) return 1;
  return 0;
};

// The page an address was published on says what kind of desk it belongs to.
const pathScore = (url) => {
  const p = String(url || '').toLowerCase();
  if (/press|media|news-?room|enquir|public-?affair/.test(p)) return 2;
  if (/career|job|vacanc|graduate|human-?resource|payroll|procure|supplier|tender/.test(p)) return -2;
  return 0;
};

const bare = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0];

/** True when the address belongs to the organisation that published it. */
function ownAddress(email, host) {
  const domain = String(email || '').split('@')[1] || '';
  const here = bare(host);
  if (!domain || !here) return false;
  if (domain === here || domain.endsWith(`.${here}`)) return true;
  return false;
}

/**
 * The mailbox the desk writes to. The press desk first, then the general desk
 * of the organisation, then any address on its own domain. An address of a
 * stranger is never taken - unless it reads like a press desk of a public
 * body: justice.gov publishes press@usdoj.gov, and that is the desk.
 */
function chooseAddress(pool, host) {
  const scored = pool
    .map((p) => ({ ...p, score: deskScore(p.email.split('@')[0]) + pathScore(p.url) }))
    .sort((a, b) => b.score - a.score);
  const own = scored.find((p) => ownAddress(p.email, host));
  if (own) return own.score >= 1 ? own : null;
  // Another domain, but the name of a press desk of a public body.
  const foreign = scored.find(
    (p) => deskScore(p.email.split('@')[0]) >= 2 && /\.(gov|int|mil)(\.[a-z]{2})?$/.test(p.email.split('@')[1] || ''),
  );
  return foreign || null;
}

export function pickAddress(emails, host) {
  const list = [...new Set((emails || []).map((e) => String(e).trim().toLowerCase()))].filter(Boolean);
  const chosen = chooseAddress(list.map((email) => ({ email })), host);
  return chosen ? chosen.email : null;
}

// The words on a link that promise a way to write to somebody.
const CONTACT_HINT = /contact|media|press|enquir|news-?room|reach|write|impressum/i;
const ASSET = /\.(css|js|mjs|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|pdf)(\?|$)/i;

async function fetchHtml(url, timeoutMs = 7000) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!/text\/html/i.test(type)) return null;
    // The address the page ended at, not the one that was asked for: a site
    // that redirects to its "www" would otherwise send the desk back to the
    // front page.
    return { url: res.url || url, html: await res.text() };
  } catch {
    return null;
  }
}

/**
 * The pages of a site, read at the same time. Many sites only answer on
 * "www", so a silent host gets a second try under that name.
 */
async function hostPages(host, paths, timeoutMs) {
  const wanted = ['', ...paths];
  const read = async (name) =>
    (await Promise.all(wanted.map((path) => fetchHtml(`https://${name}${path || '/'}`, timeoutMs)))).filter(Boolean);
  const pages = await read(host);
  if (pages.length || host.startsWith('www.')) return pages;
  return read(`www.${host}`);
}

/**
 * Some sites hide the address behind a code that every browser solves, so
 * that harvesters do not collect it. The desk solves it too: the address is
 * published for the people who write to the press office.
 */
function cfEmails(html) {
  const text = String(html || '');
  const codes = [
    ...[...text.matchAll(/data-cfemail=["']([0-9a-f]{4,})["']/gi)].map((m) => m[1]),
    ...[...text.matchAll(/email-protection#([0-9a-f]{4,})/gi)].map((m) => m[1]),
  ];
  const out = [];
  for (const hex of codes) {
    if (hex.length % 2) continue;
    const key = parseInt(hex.slice(0, 2), 16);
    let decoded = '';
    for (let i = 2; i < hex.length; i += 2) decoded += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(decoded)) out.push(decoded);
  }
  return out;
}

const addressesOf = (html) =>
  [...new Set(
    [
      ...[...String(html || '').matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => m[1]),
      ...[...String(html || '').matchAll(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)].map((m) => m[1]),
      ...cfEmails(html),
    ].map((e) => e.trim().toLowerCase()),
  )].filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !JUNK_MAIL.test(e));

/** The links on a page that lead to the contact desk of the same site. */
function contactLinks(html, host, base = `https://${host}/`, limit = 8) {
  const here = host.replace(/^www\./, '');
  const scored = [];
  const seen = new Set();
  for (const m of String(html || '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,140}?)<\/a>/gi)) {
    const href = m[1];
    const text = stripTags(m[2] || '');
    const hay = `${href} ${text}`;
    if (!CONTACT_HINT.test(hay)) continue;
    let url;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:') continue;
    if (url.hostname.replace(/^www\./, '') !== here) continue;
    if (ASSET.test(`${url.pathname}${url.search}`)) continue;
    const key = url.pathname.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // A page called "media centre" or "press office" is the desk that
    // answers questions about the story; a page called "press releases" is
    // only a list of articles.
    const pressDesk = /^(press|media)\b.*(office|desk|centre|center|contact|enquir|team)|enquir|news-?room|impressum/i.test(text)
      || /media-?cent|press-?(office|desk|enquir|team)|news-?room|impressum/i.test(url.pathname);
    const contactDesk = /contact|enquir/i.test(text) || /contact|enquir/i.test(url.pathname);
    scored.push({ url: url.toString(), rank: pressDesk ? 3 : contactDesk ? 2 : 1 });
  }
  scored.sort((a, b) => b.rank - a.rank);
  return scored.slice(0, limit);
}

/**
 * The address an organisation publishes on its own website.
 * The pages are read at the same time - one slow contact page must not cost
 * the desk two minutes of the shift. When the usual paths carry nothing, the
 * desk follows the site's own links to the contact page: the way a reporter
 * walks through a website.
 */
export async function publishedEmail(domain, { paths = CONTACT_PATHS, timeoutMs = 7000 } = {}) {
  const host = bare(domain);
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(host)) return null;

  const pages = await hostPages(host, paths, timeoutMs);
  // Every address the site publishes, and the page that publishes it.
  const found = new Map();
  const collect = (page) => {
    for (const email of addressesOf(page.html)) {
      if (!found.has(email)) found.set(email, page.url);
    }
  };
  pages.forEach(collect);
  const pool = () => [...found.entries()].map(([email, url]) => ({ email, url }));

  // A press desk on the organisation's own domain ends the hunt.
  const first = chooseAddress(pool(), host);
  if (first && first.score >= 3) return { email: first.email, sourceUrl: first.url };

  // Otherwise the site itself points to its own contact page. The desk walks
  // there - the press desk often lives only on that page, while the footer of
  // every other page carries the address for regulated firms.
  const links = pages
    .flatMap((page) => contactLinks(page.html, host, page.url))
    .sort((a, b) => b.rank - a.rank)
    .filter((l, i, all) => all.findIndex((x) => x.url === l.url) === i)
    .slice(0, 10)
    .map((l) => l.url);
  if (links.length) {
    for (const page of (await Promise.all(links.map((url) => fetchHtml(url, timeoutMs)))).filter(Boolean)) collect(page);
  }

  const best = chooseAddress(pool(), host);
  return best ? { email: best.email, sourceUrl: best.url } : null;
}

// ───────────────────── the organisation behind the name ─────────────────────
// A reporter who knows "TRM Labs" does not need a search engine to reach the
// company: they type trmlabs.com and read the press page. The desk does the
// same, but it checks that the site it found really belongs to the
// organisation before it writes an address down.

const GENERIC = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'office', 'department',
  'division', 'ministry', 'agency', 'commission', 'council', 'committee',
  'board', 'authority', 'administration', 'service', 'services', 'national',
  'federal', 'state', 'international', 'united', 'states', 'group', 'holding',
  'company', 'corporation', 'bank', 'media', 'news', 'press', 'research',
  'foundation', 'institute', 'university', 'college', 'academy', 'centre',
  'center', 'alliance', 'union', 'association', 'global', 'world', 'public',
  'private', 'first', 'general', 'deputy', 'minister', 'secretariat', 'team',
  'unit', 'force', 'issuer', 'holding', 'sister', 'parent', 'subsidiary',
  'security', 'incident', 'response', 'operations', 'intelligence', 'legal',
  'corporate', 'communications', 'publicity', 'relations', 'government',
  'president', 'officer', 'executive', 'chief', 'founder', 'headquarters',
  'group', 'group', 'and', 'of', 'or', 'in', 'at', 'to', 'by', 'its', 'their',
]);

// A name that is a common word says nothing about who owns the site. Those
// are left alone rather than guessed at.
const AMBIGUOUS = new Set([
  'circle', 'global', 'group', 'first', 'national', 'world', 'international',
  'federal', 'state', 'union', 'bank', 'media', 'news', 'press', 'energy',
  'technology', 'technologies', 'systems', 'solutions', 'services', 'partners',
  'associates', 'capital', 'financial', 'security', 'digital', 'network',
  'networks', 'communications', 'enterprises', 'ventures', 'industries',
  'consulting', 'holdings', 'general', 'united', 'american', 'british',
  'european', 'asian', 'african', 'chinese', 'indian', 'russian', 'ministry',
  'department', 'agency', 'commission', 'council', 'committee', 'court',
  'office', 'administration', 'people', 'human', 'rights', 'watch', 'newsroom',
  'times', 'daily', 'journal', 'post', 'tribune', 'herald', 'express',
  'review', 'report', 'today', 'insight', 'insights', 'outlook', 'dispatch',
]);

const letters = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// The glue words of a name. They carry no meaning and make the phrase on the
// letterhead unreadable.
const FILLER = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'its', 'their', 'our',
  'are', 'was', 'has', 'have', 'not', 'but', 'all', 'any', 'who', 'per', 'via',
]);

// The words that join a name together and say nothing about it: the initials
// of "Securities and Exchange Commission" are sec, not sae.
const GLUE = new Set([...FILLER, 'of', 'a', 'an']);

/** The organisation itself, without the team or the person that follows it. */
export function organisationName(org) {
  const text = String(org || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const head = text.split(/\s+[–—-]\s*|\s*\/\s*|\s*,\s*|\s*:\s*/)[0].trim();
  // The tag in brackets describes the organisation, it is not its name.
  const name = head.split('(')[0].trim();
  return name || head || text;
}

/** The word in brackets: what tells one firm from another. */
export function organisationQualifier(org) {
  const m = String(org || '').match(/\(([^)]+)\)/);
  if (!m) return '';
  const text = m[1].replace(/\s+/g, ' ').trim();
  // A long explanation in brackets is part of the description, not a tag.
  if (!text || text.split(' ').length > 3) return '';
  return text;
}

/** The words that tell one organisation from another. */
export function organisationTokens(org) {
  const name = organisationName(org);
  const qualifier = organisationQualifier(org);
  const words = (text) => [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !GENERIC.has(w)),
    ),
  ];
  // Every word of the name except the glue: these make the phrase the
  // organisation writes on its own letterhead.
  const content = [
    ...new Set(
      String(name || '')
        .toLowerCase()
        .replace(/\bu\.s\./g, 'us')
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !FILLER.has(w)),
    ),
  ];
  // The name as the organisation writes its own address: no glue, no country
  // mark in front. "U.S. Department of Justice" is justice.gov, "Bank of
  // England" is bankofengland.co.uk.
  const brand = [
    ...new Set(
      String(name || '')
        .toLowerCase()
        .replace(/\bu\.s\./g, 'us')
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 2 && !FILLER.has(w)),
    ),
  ];
  while (brand.length >= 2 && /^(us|usa|uk|united)$/.test(brand[0])) {
    const pair = `${brand[0]} ${brand[1]}`;
    if (/^(united states|united kingdom)$/.test(pair)) brand.shift();
    brand.shift();
  }
  return {
    name,
    qualifier,
    compact: letters(name),
    words: words(name),
    qualifierWords: words(qualifier),
    contentWords: content,
    brandWords: brand,
  };
}

/** The sites an organisation is likely to publish its address on. */
export function candidateHosts(org) {
  const t = organisationTokens(org);
  const out = new Set();
  const publicBody = PUBLIC_BODY.test(t.name);
  // A public body lives under .gov, a company under .com.
  const tlds = publicBody ? ['.gov', '.gov.uk', '.int', '.org', '.com'] : ['.com', '.co.uk', '.org', '.net', '.io'];

  // The organisation's own mark: SFC, IC3, FinCEN, IAEA.
  const acronym = t.qualifier.trim();
  const caps = (acronym.match(/[A-Z]/g) || []).length;
  if (/^[A-Za-z0-9]{2,6}$/.test(acronym) && (acronym === acronym.toUpperCase() || caps >= 2)) {
    const a = acronym.toLowerCase();
    for (const tld of ['.gov.hk', '.hk', '.gov', '.gov.uk', '.org', '.com']) out.add(a + tld);
  }
  // A segment that is nothing but capitals: FBI, DOJ, SFO.
  for (const segment of String(org || '').split(/\s+[–—]\s*|\s*\/\s*|\s*,\s*|\s*:\s*|\s+-\s+/)) {
    const s = segment.trim();
    if (/^[A-Z]{2,6}$/.test(s)) {
      for (const tld of ['.gov', '.org', '.com', '.net']) out.add(s.toLowerCase() + tld);
    }
  }
  // The initials of the name: Federal Trade Commission is ftc.gov.
  const initials = t.brandWords.filter((w) => w !== 'of').map((w) => w[0]).join('');
  if (initials.length >= 3 && initials.length <= 6) {
    for (const tld of ['.gov', '.org', '.com', '.net']) out.add(initials + tld);
  }

  // The name itself: TRM Labs is trmlabs.com, Bank of England is
  // bankofengland.co.uk.
  const joined = t.brandWords.slice(0, 4).join('');
  if (joined.length >= 4) {
    for (const tld of tlds) out.add(joined + tld);
  }
  const hyphen = t.brandWords.slice(0, 3).join('-');
  if (hyphen !== joined && hyphen.length >= 4) out.add(`${hyphen}.com`);

  // The last word of the name is often the whole mark: justice.gov.
  const last = t.brandWords[t.brandWords.length - 1];
  if (last && last.length >= 4 && !AMBIGUOUS.has(last) && last !== joined) {
    for (const tld of tlds) out.add(last + tld);
  }

  if (t.contentWords.length === 1 && !AMBIGUOUS.has(t.contentWords[0])) {
    for (const tld of tlds) out.add(t.contentWords[0] + tld);
  }
  return [...out].slice(0, 10);
}

/**
 * The forms a site may carry in its address: the words of the name, the name
 * written as one word, the initials of the name and the tag in brackets.
 *
 * A site must carry one of them whole. "sec.gov" is the Securities and
 * Exchange Commission, but "sec" is only a piece of "Securities" - the Hong
 * Kong regulator must not be reached through the American one.
 */
function hostForms(org) {
  const t = organisationTokens(org);
  const forms = new Set();
  const words = String(t.name || '')
    .toLowerCase()
    .replace(/\bu\.s\./g, 'us')
    .replace(/\bu\.k\./g, 'uk')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((w) => !/^(a|an|the)$/.test(w));
  // A country mark in front is not part of the name.
  while (words.length >= 2 && /^(us|usa|uk|united)$/.test(words[0])) {
    const pair = `${words[0]} ${words[1]}`;
    if (/^(united states|united kingdom)$/.test(pair)) words.shift();
    words.shift();
  }
  for (let i = 0; i < words.length; i++) {
    forms.add(words[i]);
    for (let n = 2; n <= 4 && i + n <= words.length; n++) forms.add(words.slice(i, i + n).join(''));
  }
  // The initials of the name without its glue: securities, exchange,
  // commission is sec.
  const content = words.filter((w) => !GLUE.has(w));
  for (let i = 0; i < content.length; i++) {
    for (let n = 2; n <= 4 && i + n <= content.length; n++) {
      const initials = content.slice(i, i + n).map((w) => w[0]).join('');
      if (initials.length >= 3) forms.add(initials);
    }
  }
  // The tag in brackets is a mark of its own: SFC, FATF, IC3.
  const tag = letters(t.qualifier);
  if (tag) forms.add(tag);
  return forms;
}

/** True when the host carries the organisation's name in it. */
export function hostBelongsTo(host, org) {
  const forms = hostForms(org);
  if (!forms.size) return false;
  // Every part of the name: home.treasury.gov is the Treasury, fatf-gafi.org
  // is the task force. The endings of a domain say nothing: "com" is inside
  // "commission", and that would let any site pass for any commission.
  return bare(host)
    .split('.')
    .some((label) =>
      label
        .split(/[^a-z0-9]+/i)
        .some((part) => part.length >= 3 && !SUFFIX.has(part) && forms.has(part)),
    );
}

/**
 * The names the organisation answers to: "Federal Trade Commission",
 * "Department of Justice", "Internet Crime Complaint Center". A page that
 * carries one of them is a page about this organisation.
 */
export function organisationPhrases(org) {
  const text = String(org || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const parts = text.split(/\s+[–—]\s*|\s*\/\s*|\s*,\s*|\s*:\s*|\s+-\s+/);
  const out = new Set();
  for (const part of parts) {
    // The tag in brackets is the qualifier, not the name.
    const before = part.includes('(') ? part.slice(0, part.indexOf('(')) : part;
    const words = before
      .replace(/\bu\.s\./gi, 'us')
      .replace(/\bu\.k\./gi, 'uk')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w.toLowerCase());
    // A country mark in front is not part of the name.
    while (words.length && /^(us|usa|uk|the|a|an|of)$/.test(words[0])) words.shift();
    if (words.length) out.add(words.join(' '));
    // "Hong Kong Securities and Futures Commission" is written without the
    // country more often than with it.
    for (let k = 1; k <= 2 && words.length - k >= 3; k++) out.add(words.slice(k).join(' '));
  }
  return [...out];
}

/** The text a reader sees, without the scripts and the stylesheets. */
function visibleText(html) {
  return String(html || '')
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const flatText = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

/** True when the page carries every word of the organisation's own name. */
export function namesOrganisation(pageText, org) {
  const t = organisationTokens(org);
  const page = flatText(pageText);
  if (!page || !t.brandWords.length) return false;
  return t.brandWords.every((word) => new RegExp(`\\b${word}\\b`).test(page));
}

/** True when the page the desk read belongs to the organisation it is asking. */
export function pageMatchesOrganisation(pageText, org) {
  const t = organisationTokens(org);
  const page = flatText(pageText);
  if (!page) return false;
  const has = (word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(page);

  if (t.qualifierWords.length) {
    // "Circle (USDC Issuer)" is not a Yiddish school: the qualifier has to be
    // on the page as well.
    const qualHits = t.qualifierWords.filter(has).length;
    if (qualHits !== t.qualifierWords.length) return false;
    return t.words.some(has);
  }

  // The organisation's own name, written the way the organisation writes it.
  for (const phrase of organisationPhrases(org)) {
    const words = phrase.split(' ');
    if (words.length === 1) {
      if (AMBIGUOUS.has(words[0]) || words[0].length < 4) continue;
      if (has(words[0])) return true;
      continue;
    }
    if (page.includes(phrase)) return true;
  }
  return false;
}

/** A public body is reached at .gov and .int, a company at .com and .org. */
const PUBLIC_BODY = /department|ministry|agency|commission|court|office|administration|council|committee|police|intelligence|congress|senate|parliament|government|federal|national|state|treasury|justic|regulat|supervisor|authority|central bank|fbi|criminal|interpol|europol/i;

function pickHost(verified, org) {
  const wanted = PUBLIC_BODY.test(organisationName(org))
    ? /\.(gov|int)(\.[a-z]{2})?$/
    : /\.(com|org|net|io|co|to|hk)$/;
  return verified.find((h) => wanted.test(h)) || verified[0];
}

async function readHome(host, timeoutMs = 7000) {
  const page = await fetchHtml(`https://${host}/`, timeoutMs);
  if (page) return page;
  if (host.startsWith('www.')) return null;
  return fetchHtml(`https://www.${host}/`, timeoutMs);
}

/**
 * Read the address off the organisation's own site - but only when the site
 * really is theirs.
 */
async function addressFromHosts(hosts, org, timeoutMs, { strong = false } = {}) {
  const candidates = [...new Set(hosts)].filter(Boolean).slice(0, 8);
  if (!candidates.length) return null;
  const pages = await Promise.all(candidates.map((host) => readHome(host, timeoutMs)));
  const verified = candidates.filter((host, i) => {
    const page = pages[i];
    if (!page) return false;
    const text = visibleText(page.html);
    // A site the encyclopaedia names as the official one has to carry the
    // whole name, not only a word of it.
    return strong ? namesOrganisation(text, org) : pageMatchesOrganisation(text, org);
  });
  if (!verified.length) return null;

  // One organisation, one site: the desk writes to the address it found on
  // the site it is sure about, or to nobody.
  const host = pickHost(verified, org);
  return publishedEmail(host, { timeoutMs }).catch(() => null);
}

/**
 * Where does this organisation tell the world how to write? A reporter asks
 * the encyclopaedia, which knows the official site of every regulator, court
 * and company. The desk asks the same two questions and keeps only the sites
 * that carry the organisation's own name.
 */
async function discoverHosts(org) {
  const t = organisationTokens(org);
  if (!t.name) return [];

  const titles = await wikiSearch(t.name);
  // The article has to be about this organisation, not about a namesake.
  const scored = titles
    .map((title) => ({ title, score: t.brandWords.filter((w) => title.toLowerCase().includes(w)).length }))
    .filter((x) => x.score >= 2 || (x.score === 1 && t.compact.length > 6))
    .sort((a, b) => b.score - a.score);

  const out = new Set();
  for (const cand of scored.slice(0, 2)) {
    const sites = await officialSitesOf(cand.title);
    // The site the encyclopaedia names is the organisation's own.
    for (const site of sites.official) {
      const host = hostOf(site);
      if (host && host !== 'unknown') out.add(host);
    }
    // The links the article lists are only worth a look when they carry the
    // organisation's name.
    for (const site of sites.links) {
      const host = hostOf(site);
      if (!host || host === 'unknown') continue;
      if (!hostBelongsTo(host, org)) continue;
      out.add(host);
    }
    if (out.size >= 3) break;
  }
  return [...out];
}

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

async function wikiJson(params) {
  const url = `${WIKI_API}?${new URLSearchParams({ format: 'json', ...params })}`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function wikiSearch(query) {
  const data = await wikiJson({ action: 'query', list: 'search', srsearch: query, srlimit: '6', srnamespace: '0' });
  return (data?.query?.search || []).map((s) => String(s.title || '')).filter(Boolean);
}

/** The official website of an encyclopaedia article: Wikidata first, then the
 *  links the article itself lists as its own website. */
async function officialSitesOf(title) {
  const official = new Set();
  const links = new Set();
  const props = await wikiJson({ action: 'query', prop: 'pageprops', ppprop: 'wikibase_item', titles: title });
  const page = props?.query?.pages ? props.query.pages[Object.keys(props.query.pages)[0]] : null;
  const qid = page?.pageprops?.wikibase_item;
  if (qid) {
    try {
      const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const entity = (await res.json())?.entities?.[qid];
        for (const claim of entity?.claims?.P856 || []) {
          const value = claim?.mainsnak?.datavalue?.value;
          if (typeof value === 'string' && /^https?:\/\//i.test(value)) official.add(value);
        }
      }
    } catch {
      // The encyclopaedia is a help, not a requirement.
    }
  }
  const ext = await wikiJson({ action: 'query', prop: 'extlinks', ellimit: '60', titles: title });
  const found = ext?.query?.pages ? ext.query.pages[Object.keys(ext.query.pages)[0]]?.extlinks || [] : [];
  for (const link of found) {
    const url = String(link['*'] || '');
    if (/^https?:\/\//i.test(url) && !/facebook|twitter|x\.com|instagram|linkedin|youtube|wikimedia|commons/i.test(url)) links.add(url);
  }
  return { official: [...official], links: [...links] };
}

/**
 * The organisations a contact line names. A line like "Law enforcement
 * (Interpol / national cybercrime units)" is a wish list, and the desk writes
 * to the first name on it that it can reach.
 */
export function candidateOrganisations(org) {
  const text = String(org || '').trim();
  if (!text) return [];
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && /[/;,]/.test(ch)) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  const out = [];
  const add = (value) => {
    const piece = String(value || '').trim().replace(/\s+/g, ' ').trim();
    if (piece.length < 4) return;
    if (/^e\.?g\.?|^i\.?e\.?|^etc\.?|^such as|^and others/i.test(piece)) return;
    if (!out.includes(piece)) out.push(piece);
  };

  add(text);
  for (const part of parts) {
    for (const piece of part.split(/\s+or\s+/i)) add(piece);
  }
  // What the bracket names: Interpol is a name, "USDT Issuer" is not.
  const bracket = text.match(/\(([^)]+)\)/);
  if (bracket) {
    for (const piece of bracket[1].split(/[/,]/)) add(piece);
  }
  return out.slice(0, 5);
}

/**
 * The address to write to, found the way a reporter finds it: from the
 * organisation's own name, on the organisation's own site - and only when the
 * site really is theirs.
 */
export async function pressAddressFor(org, { hosts = [], timeoutMs = 7000, discover = true, budgetMs = 45_000 } = {}) {
  // One contact must not eat the shift: a site that answers slowly is worth
  // less than the addresses that are still waiting.
  const until = Date.now() + budgetMs;
  for (const candidate of candidateOrganisations(org)) {
    if (Date.now() > until) break;
    const found = await addressForOne(candidate, { hosts, timeoutMs, discover, until });
    if (found) return found;
  }
  return null;
}

async function addressForOne(org, { hosts = [], timeoutMs = 7000, discover = true, until = 0 } = {}) {
  const t = organisationTokens(org);
  if (!t.words.length && !t.qualifierWords.length) return null;

  // A host the desk already cited in this story: the address is then read off
  // a site the desk has already decided belongs to the story.
  for (const host of hosts) {
    if (hostBelongsTo(host, org)) {
      const found = await publishedEmail(host, { timeoutMs }).catch(() => null);
      if (found) return found;
    }
    if (Date.now() > until) return null;
  }

  // Otherwise the organisation's own site, found from its name and checked.
  const guessed = await addressFromHosts(candidateHosts(org), org, timeoutMs);
  if (guessed) return guessed;
  if (Date.now() > until) return null;

  // Still nothing: the desk asks the encyclopaedia where this organisation's
  // contact page lives and reads the address there.
  if (discover) {
    const learned = await addressFromHosts(await discoverHosts(org), org, timeoutMs, { strong: true });
    if (learned) return learned;
  }
  return null;
}



