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

// One shared word is not a match: the UN newsroom carries the word "new" in
// every headline, and a cabinet that answers with one word answers with
// everything. Two words, or one when the question has only one.
const matches = (text, terms) => {
  const t = String(text || '').toLowerCase();
  if (!terms.length) return false;
  const needed = Math.min(2, terms.length);
  let hits = 0;
  for (const x of terms) if (t.includes(x)) hits++;
  return hits >= needed;
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
  if (!terms.length) return [];
  const url = `https://search.worldbank.org/api/v2/procnotices?format=json&qterm=${encodeURIComponent(terms.join(' '))}&rows=15`;
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
    .filter((n) => n.title.replace(/^Notice:\s*/, '').trim().length > 12 && matches(`${n.title} ${n.summary}`, terms))
    .slice(0, 10);
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

// An address on another domain is only taken when it reads like the desk of
// that organisation. A privacy officer, a support desk or a lawyer in the
// footer is not the press office.
const PRESS_LOCAL = /^(press|media|news|newsroom|contact|contacts|editorial|editors?|desk|communications|comms|inquir\w*|press-?office|press-?desk|press-?contact|media-?inquir\w*)/i;

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

/** The address of the organisation, or of its press office on its own domain. */
export function pickAddress(emails, host) {
  const own = emails.filter((e) => ownAddress(e, host));
  const press = own.find((e) => PRESS_LOCAL.test(e.split('@')[0]));
  if (press) return press;
  if (own.length) return own[0];
  // Another domain, but the name of a press desk: justice.gov publishes
  // press@usdoj.gov, and that is the address the desk has to write to.
  return emails.find((e) => PRESS_LOCAL.test(e.split('@')[0])) || null;
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
    return { url, html: await res.text() };
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

const addressesOf = (html) =>
  [...new Set(
    [
      ...[...String(html || '').matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => m[1]),
      ...[...String(html || '').matchAll(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)].map((m) => m[1]),
    ].map((e) => e.trim().toLowerCase()),
  )].filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !JUNK_MAIL.test(e));

/** The links on a page that lead to the contact desk of the same site. */
function contactLinks(html, host, limit = 8) {
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
      url = new URL(href, `https://${here}/`);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:') continue;
    if (url.hostname.replace(/^www\./, '') !== here) continue;
    if (ASSET.test(`${url.pathname}${url.search}`)) continue;
    const key = url.pathname.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // A page called "contact" is the contact page.
    const rank = /contact/i.test(hay) ? 3 : /media|press|enquir|news-?room|impressum/i.test(hay) ? 2 : 1;
    scored.push({ url: url.toString(), rank });
  }
  scored.sort((a, b) => b.rank - a.rank);
  return scored.slice(0, limit).map((s) => s.url);
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

  for (const page of pages) {
    const emails = addressesOf(page.html);
    if (!emails.length) continue;
    const pick = pickAddress(emails, host);
    if (pick) return { email: pick, sourceUrl: page.url };
  }

  // No address on the usual paths: the site itself points to its own contact
  // page. The desk walks there.
  const links = pages.flatMap((page) => contactLinks(page.html, host)).slice(0, 6);
  if (!links.length) return null;
  for (const page of (await Promise.all(links.map((url) => fetchHtml(url, timeoutMs)))).filter(Boolean)) {
    const emails = addressesOf(page.html);
    if (!emails.length) continue;
    const pick = pickAddress(emails, host);
    if (pick) return { email: pick, sourceUrl: page.url };
  }
  return null;
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

/** True when the host carries the organisation's name in it. */
export function hostBelongsTo(host, org) {
  const t = organisationTokens(org);
  const hay = `${t.compact}${letters(t.qualifier)}`;
  if (!hay) return false;
  // Every part of the name: home.treasury.gov is the Treasury, fatf-gafi.org
  // is the task force.
  return bare(host)
    .split('.')
    .some((label) =>
      label
        .split(/[^a-z0-9]+/i)
        .some((part) => part.length >= 3 && hay.includes(part)),
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
  const page = pages[candidates.indexOf(host)];
  const own = pickAddress(addressesOf(page.html), host);
  if (own) return { email: own, sourceUrl: page.url };
  const found = await publishedEmail(host, { timeoutMs }).catch(() => null);
  return found;
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
 * The address to write to, found the way a reporter finds it: from the
 * organisation's own name, on the organisation's own site - and only when the
 * site really is theirs.
 */
export async function pressAddressFor(org, { hosts = [], timeoutMs = 7000, discover = true } = {}) {
  const t = organisationTokens(org);
  if (!t.words.length && !t.qualifierWords.length) return null;

  // A host the desk already cited in this story: the address is then read off
  // a site the desk has already decided belongs to the story.
  for (const host of hosts) {
    if (!hostBelongsTo(host, org)) continue;
    const found = await publishedEmail(host, { timeoutMs }).catch(() => null);
    if (found) return found;
  }

  // Otherwise the organisation's own site, found from its name and checked.
  const guessed = await addressFromHosts(candidateHosts(org), org, timeoutMs);
  if (guessed) return guessed;

  // Still nothing: the desk asks the encyclopaedia where this organisation's
  // contact page lives and reads the address there.
  if (discover) {
    const learned = await addressFromHosts(await discoverHosts(org), org, timeoutMs, { strong: true });
    if (learned) return learned;
  }
  return null;
}



