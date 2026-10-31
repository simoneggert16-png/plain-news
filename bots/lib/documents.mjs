// The desk's document finder.
//
// A reporter does not google the papers behind a story — they know which
// drawer they are filed in. This is the desk's registry of those drawers:
// the Justice Department's press releases, the sanctions office's recent
// actions, the UN newsroom, the chain-analysis firms' research notes. Every
// door hands back real, citable addresses, so the desk can walk them on its
// own instead of waiting for a search engine to answer from a datacenter.
//
// DuckDuckGo and Mojeek answer datacenter requests with an anti-bot page, so
// the news index is the last resort here, not the way in.

const UA = 'Mozilla/5.0 (compatible; PlainNewsBot/1.0; +https://plain-news.ch)';

const ENTITIES = {
  amp: '&', quot: '"', lt: '<', gt: '>', nbsp: ' ', '#x27': "'", '#39': "'", '#38': '&', '#60': '<', '#62': '>',
};
const decodeEntities = (s = '') =>
  String(s || '').replace(/&(?:amp|quot|lt|gt|nbsp|#x27|#39|#38|#60|#62);/g, (m) => ENTITIES[m.slice(1, -1)] ?? m);

const stripTags = (s = '') =>
  decodeEntities(String(s || '').replace(/<!\[CDATA\[|\]\]>/g, ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  };
};

// ─────────────────────────── the registry ───────────────────────────
// `about` is the vocabulary the institution writes in: it says when this
// door is worth walking and what words to look for in what it files.
export const INSTITUTIONS = [
  {
    id: 'chainalysis',
    outlet: 'Chainalysis',
    kind: 'rss',
    url: 'https://www.chainalysis.com/feed/',
    about: ['crypto', 'bitcoin', 'ethereum', 'wallet', 'hack', 'heist', 'theft', 'stolen', 'launder', 'blockchain', 'exchange', 'north korea', 'dprk', 'lazarus', 'bitget', 'binance', 'bybit', 'attribution'],
  },
  {
    id: 'trmlabs',
    outlet: 'TRM Labs',
    kind: 'rss',
    url: 'https://www.trmlabs.com/resources/blog/rss.xml',
    about: ['crypto', 'bitcoin', 'ethereum', 'wallet', 'hack', 'heist', 'theft', 'stolen', 'launder', 'blockchain', 'exchange', 'north korea', 'dprk', 'lazarus', 'bitget', 'binance', 'bybit', 'attribution'],
  },
  {
    id: 'ofac',
    outlet: 'US Treasury (OFAC)',
    kind: 'html',
    url: 'https://ofac.treasury.gov/recent-actions',
    link: /\/recent-actions\/\d{6,8}/,
    timeout: 25000,
    about: ['north korea', 'dprk', 'lazarus', 'sanction', 'terror', 'iraq', 'syria', 'iran', 'crypto', 'bitcoin', 'launder', 'bank', 'embargo', 'general license', 'designation'],
  },
  {
    id: 'doj',
    outlet: 'US Department of Justice',
    kind: 'rss',
    url: 'https://www.justice.gov/news/rss?type=press_release',
    about: ['money', 'launder', 'bank', 'crypto', 'bitcoin', 'wallet', 'hack', 'heist', 'theft', 'stolen', 'fraud', 'traffick', 'narcotic', 'drug', 'terror', 'weapon', 'corrupt', 'north korea', 'lazarus', 'dprk', 'sanction', 'embargo', 'child', 'abuse', 'prostitut', 'human traffick', 'indict', 'plea'],
  },
  {
    id: 'ic3',
    outlet: 'FBI Internet Crime Complaint Center',
    kind: 'html',
    url: 'https://www.ic3.gov/PSA/2026',
    link: /\/PSA\/\d{4}\/PSA\d+/,
    about: ['cyber', 'hack', 'heist', 'breach', 'ransom', 'phish', 'scam', 'fraud', 'crypto', 'bitcoin', 'wallet', 'stolen', 'theft', 'extortion', 'north korea', 'dprk', 'vulnerability'],
  },
  {
    id: 'treasury',
    outlet: 'US Treasury',
    kind: 'rss',
    url: 'https://home.treasury.gov/news/press-releases/rss',
    timeout: 12000,
    about: ['north korea', 'dprk', 'lazarus', 'sanction', 'terror', 'crypto', 'bitcoin', 'launder', 'bank', 'embargo'],
  },
  {
    id: 'un',
    outlet: 'UN News',
    kind: 'rss',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    about: ['north korea', 'dprk', 'korea', 'human rights', 'war', 'conflict', 'sanction', 'hunger', 'climate', 'displacement', 'refugee', 'panel of experts', 'repression'],
  },
  // The UN Human Rights Office was on this list with its /en/rss.xml feed.
  // That feed is not a newswire: it lists evergreen topic pages ("Sport and
  // human rights") without a date, so the desk read the same landing pages
  // every morning. Its news feed sits behind a Cloudflare challenge. The two
  // human-rights organisations below publish dated statements and reports
  // instead, and their investigations name the people the desk writes about.
  {
    id: 'hrw',
    outlet: 'Human Rights Watch',
    kind: 'rss',
    url: 'https://www.hrw.org/rss/news',
    about: ['human rights', 'detention', 'disappear', 'torture', 'migration', 'refugee', 'stateless', 'indigenous', 'minority', 'north korea', 'dprk', 'forced labour', 'war crime', 'journalist', 'protest', 'censorship'],
  },
  {
    id: 'amnesty',
    outlet: 'Amnesty International',
    kind: 'rss',
    url: 'https://www.amnesty.org/en/latest/feed/',
    about: ['human rights', 'detention', 'disappear', 'torture', 'migration', 'refugee', 'stateless', 'indigenous', 'minority', 'north korea', 'dprk', 'forced labour', 'arms', 'surveillance', 'protest', 'censorship'],
  },
  {
    id: 'gao',
    outlet: 'US Government Accountability Office',
    kind: 'rss',
    url: 'https://www.gao.gov/rss/reports.xml',
    about: ['audit', 'budget', 'spend', 'fraud', 'waste', 'programme', 'program', 'oversight', 'contract', 'procurement'],
  },
  {
    id: 'cisa',
    outlet: 'US Cybersecurity and Infrastructure Security Agency',
    kind: 'rss',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    about: ['cyber', 'hack', 'breach', 'ransom', 'vulnerab', 'malware', 'software', 'advisory'],
  },
  // The desk works internationally, and a front page made only of Washington
  // agencies is not the world. These cabinets answer from a runner and publish
  // in English: the commission that fines, the agency that hunts, the court
  // that indicted, the consortium that holds the papers.
  {
    id: 'ec',
    outlet: 'European Commission',
    kind: 'rss',
    url: 'https://ec.europa.eu/commission/presscorner/api/rss?language=en&pagesize=40',
    timeout: 20000,
    about: ['antitrust', 'merger', 'state aid', 'competition', 'fine', 'sanction', 'tariff', 'trade', 'procurement', 'fraud', 'subsid', 'digital', 'data protection', 'migration', 'asylum', 'climate', 'energy', 'enlargement', 'rule of law', 'budget', 'euro', 'european union'],
  },
  {
    id: 'europol',
    outlet: 'Europol',
    kind: 'rss',
    url: 'https://www.europol.europa.eu/cms/api/rss/news',
    timeout: 20000,
    about: ['organised crime', 'organized crime', 'trafficking', 'smuggling', 'migrant', 'cybercrime', 'ransomware', 'fraud', 'money laundering', 'launder', 'drug', 'cocaine', 'cartel', 'arrest', 'seizure', 'most wanted', 'europol'],
  },
  {
    id: 'nca',
    outlet: 'UK National Crime Agency',
    kind: 'rss',
    url: 'https://www.nationalcrimeagency.gov.uk/news?format=feed&type=rss',
    timeout: 20000,
    about: ['money laundering', 'kleptocracy', 'bribery', 'corrupt', 'sanction', 'smuggling', 'trafficking', 'fraud', 'cyber', 'cocaine', 'migrant', 'arrest', 'asset', 'encrochat'],
  },
  {
    id: 'icc',
    outlet: 'International Criminal Court',
    kind: 'rss',
    url: 'https://www.icc-cpi.int/rss.xml',
    timeout: 20000,
    about: ['war crime', 'genocide', 'crimes against humanity', 'arrest warrant', 'prosecutor', 'trial', 'victim', 'reparations', 'jurisdiction', 'rome statute', 'duterte', 'indict'],
  },
  {
    id: 'icij',
    outlet: 'ICIJ',
    kind: 'rss',
    url: 'https://www.icij.org/feed/',
    timeout: 20000,
    about: ['offshore', 'leak', 'panama papers', 'pandora', 'paradise papers', 'tax', 'corruption', 'bribery', 'lobby', 'deforestation', 'investigation', 'shell company'],
  },
];

// ─────────────────────────── parsing ───────────────────────────

/** Items of an RSS or Atom feed. */
function rssEntries(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const body = m[1];
    const pick = (tag) => {
      const x = body.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
      return x ? stripTags(x[1]) : '';
    };
    const link =
      pick('link') ||
      (body.match(/<link[^>]+href="([^"]+)"(?![^>]*rel="self")/i) || [])[1] ||
      '';
    const title = pick('title');
    if (!title || !link) continue;
    out.push({
      title,
      url: link.trim(),
      publishedAt: pick('pubDate') || pick('dc:date') || null,
      summary: pick('description').slice(0, 400),
    });
  }
  return out;
}

/** Entries of a listing page: the links an institution published, with their anchor text. */
function htmlEntries(html, pattern, base) {
  const out = [];
  const seen = new Set();
  for (const m of String(html).matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    if (!pattern.test(href)) continue;
    const title = stripTags(m[2]);
    if (!title || title.length < 8) continue;
    let url;
    try {
      url = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title, url, publishedAt: null, summary: '' });
  }
  return out;
}

// ─────────────────────────── relevance ───────────────────────────

const STOP = new Set([
  'this', 'that', 'with', 'from', 'have', 'were', 'been', 'will', 'about', 'after', 'over', 'into', 'says', 'said',
  'their', 'under', 'more', 'what', 'when', 'where', 'which', 'while', 'there', 'these', 'those', 'should',
  'would', 'could', 'who', 'how', 'why', 'does', 'not', 'but', 'for', 'are', 'you', 'its', 'his', 'her',
  'they', 'them', 'than', 'then', 'also', 'being', 'here', 'such', 'some', 'only', 'just', 'like', 'very',
  'much', 'most', 'many', 'other', 'same', 'own', 'via', 'using', 'based', 'reported', 'reports', 'report',
  'million', 'billion', 'dollar', 'dollars', 'money', 'year', 'years', 'month', 'months', 'week', 'day',
  'people', 'person', 'thing', 'world', 'story', 'case', 'part', 'group', 'work', 'first', 'second', 'last',
  'next', 'every', 'both', 'against', 'between', 'during', 'because', 'however', 'according', 'including',
  'without', 'within', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'usd', 'eur', 'gbp', 'chf', 'sfr', 'ceo', 'cfo', 'cto', 'coo', 'vpn', 'zoom', 'iot', 'protocol', 'office',
  'human', 'rights',
]);

const GENERIC_CAPS = new Set([
  'the', 'this', 'that', 'these', 'those', 'who', 'how', 'what', 'when', 'where', 'why', 'and', 'but', 'for',
  'not', 'one', 'two', 'three', 'four', 'five', 'first', 'second', 'last', 'next', 'every', 'after', 'before',
  'during', 'under', 'over', 'between', 'against', 'without', 'within', 'inside', 'outside', 'about',
]);

/**
 * The words that stand in every institutional document: press releases, court
 * decisions, procurement notices, agency statements. They say how a document
 * is written, not what it is about — a document that shares only these with a
 * story is about something else, however many of them it happens to use.
 */
export const BOILERPLATE = new Set([
  'court', 'courts', 'case', 'cases', 'law', 'laws', 'legal', 'lawsuit', 'lawsuits', 'judge', 'judges',
  'jury', 'trial', 'hearing', 'attorney', 'attorneys', 'prosecutor', 'prosecutors', 'prosecution', 'charges',
  'charged', 'indictment', 'indicted', 'plea', 'guilty', 'conviction', 'sentence', 'sentenced', 'appeal',
  'evidence', 'witness', 'witnesses', 'victim', 'victims', 'plaintiff', 'defendant', 'injury', 'injuries',
  'death', 'deaths', 'died', 'killed', 'injured', 'arrest', 'arrested', 'suspect', 'suspects', 'enforcement',
  'investigation', 'investigations', 'investigative', 'investigators', 'allegation', 'allegations', 'civil',
  'criminal', 'federal', 'state', 'district', 'ruling', 'order', 'orders', 'justice', 'inquiry', 'inquiries',
  'probe', 'litigation', 'complaint', 'settlement', 'damages', 'verdict', 'subpoena', 'testimony', 'filing',
  'department', 'agency', 'office', 'bureau', 'ministry', 'minister', 'ministers', 'commission', 'committee',
  'council', 'authority', 'authorities', 'official', 'officials', 'government', 'administration', 'secretary',
  'director', 'chairman', 'president', 'spokesperson', 'representative', 'organisation', 'organization',
  'organizations', 'press', 'release', 'released', 'statement', 'statements', 'comment', 'comments',
  'announcement', 'announced', 'media', 'news', 'newsroom', 'update', 'updates', 'report', 'reports',
  'reported', 'according', 'including', 'include', 'includes', 'involving', 'involved', 'using', 'used',
  'use', 'uses', 'making', 'made', 'make', 'calls', 'called', 'contact', 'contacts', 'email',
  'website', 'page', 'pages', 'homepage', 'public', 'said', 'says', 'told', 'people', 'person',
  'persons', 'individual', 'individuals', 'group', 'groups', 'family', 'families', 'company', 'companies',
  'business', 'industry', 'market', 'money', 'dollar', 'dollars', 'million', 'billion', 'percent', 'year',
  'years', 'month', 'months', 'week', 'weeks', 'day', 'days', 'hour', 'hours', 'today', 'level', 'levels',
  'amount', 'value', 'number', 'part', 'work', 'works', 'world', 'national', 'international', 'global',
  'regional', 'local', 'based', 'following', 'regarding', 'concerning', 'related', 'during', 'while', 'since',
  'until', 'about', 'against', 'between', 'through', 'across', 'into', 'over', 'under', 'after', 'before',
  'per', 'via',
]);

/**
 * Capitalised names and figures: the words a document has to use before it
 * belongs to a story. Lowercase words are the subject; they say what the
 * document is about, not who it is about.
 */
export function namedTerms(text) {
  const src = String(text || '');
  const out = new Set();
  for (const m of src.matchAll(/\b[A-Z][\p{L}]{2,}(?:['’]s)?\b/gu)) {
    const w = m[0].replace(/['’]s$/, '').toLowerCase();
    if (STOP.has(w) || GENERIC_CAPS.has(w)) continue;
    out.add(w);
  }
  for (const m of src.matchAll(/\b\d[\d.,]*\d|\b\d+\b/g)) {
    const raw = m[0];
    const digits = raw.replace(/\D/g, '');
    // Years pin nothing; sums and counts do.
    if (digits.length === 4 && Number(digits) > 1990 && Number(digits) < 2100) continue;
    const digits_ = digits.length >= 3 || (raw.includes('.') && digits.length >= 2);
    if (!digits_) continue;
    out.add(raw.toLowerCase());
    const head = raw.split(/[.,]/)[0];
    if (head.length >= 3) out.add(head.toLowerCase());
  }
  return [...out];
}

/** One name tells no more than the other: "Korean" adds nothing to "Korea". */
function collapse(terms) {
  const kept = [];
  for (const t of [...new Set(terms)].sort((a, b) => a.length - b.length)) {
    if (kept.some((k) => t.includes(k))) continue;
    kept.push(t);
  }
  return kept;
}

/** The subject words of the story: what the document has to be about. */
export function topicalTerms(text) {
  const out = new Set();
  for (const w of String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)) {
    if (w.length >= 5 && !STOP.has(w)) out.add(w);
  }
  return [...out];
}

const entryText = (e) => `${e.title || ''} ${e.summary || ''}`.toLowerCase();

// ─────────────────────────── the walk ───────────────────────────

async function fetchBody(url, { accept, timeout = 15000 }) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Everything one institution currently has filed.
 *
 * @returns {Promise<{title:string,url:string,outlet:string,publishedAt:string|null,summary:string}[]>}
 */
export async function institutionDocuments(institution, { limit = 60 } = {}) {
  const body = await fetchBody(institution.url, {
    accept: institution.kind === 'rss' ? 'application/rss+xml,application/xml,*/*' : 'text/html',
    timeout: institution.timeout || 15000,
  });
  const entries =
    institution.kind === 'rss'
      ? rssEntries(body)
      : htmlEntries(body, institution.link, institution.url);
  return entries.slice(0, limit).map((e) => ({ ...e, outlet: institution.outlet, id: institution.id }));
}

/**
 * The documents the institutions hold for this story, best first.
 *
 * The subject of the story — the names in the headline and the brief — is
 * what a document has to use to belong to it. The brief's own names count
 * only when they are rare: "North Korea" in every headline names nothing,
 * "Bitget" in two headlines names the victim.
 *
 * @param {string} story    title, angle and topic of the investigation
 * @param {string} context  the brief's hints: names worth a second look
 */
export async function institutionalDocuments(story, { context = '', maxInstitutions = 6, limit = 24 } = {}) {
  const subjectText = String(story || '');
  const subject = collapse(namedTerms(subjectText));
  if (!subject.length) return [];

  // The doors this story calls for, most relevant first.
  const doors = INSTITUTIONS.map((inst) => ({
    inst,
    score: inst.about.reduce((n, k) => (subjectText.toLowerCase().includes(k) ? n + 1 : n), 0),
  }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxInstitutions);

  const groups = await Promise.all(
    doors.map(async (d) => ({
      outlet: d.inst.outlet,
      entries: await institutionDocuments(d.inst).catch(() => []),
    }))
  );
  const pool = groups.flatMap((g) => g.entries);
  if (!pool.length) return [];

  // How often each name turns up in what the institutions filed. A name that
  // appears everywhere names nothing.
  const candidates = new Set([...subject, ...namedTerms(context)]);
  const df = new Map();
  for (const term of candidates) {
    df.set(term, pool.filter((e) => entryText(e).includes(term)).length);
  }
  const maxDf = Math.max(3, Math.floor(pool.length * 0.1));
  const contextTerms = collapse(namedTerms(context)).filter((t) => (df.get(t) || 0) <= maxDf);

  const topical = topicalTerms(subjectText);
  const scored = [];
  const seen = new Set();
  for (const group of groups) {
    for (const e of group.entries) {
      if (seen.has(e.url)) continue;
      seen.add(e.url);
      const text = entryText(e);
      let weight = 0;
      const hits = [];
      for (const t of subject) {
        if (!text.includes(t)) continue;
        hits.push(t);
        weight += (df.get(t) || 0) <= 3 ? 4 : 3;
      }
      for (const t of contextTerms) {
        if (!text.includes(t)) continue;
        hits.push(t);
        weight += (df.get(t) || 0) <= 3 ? 3 : 2;
      }
      if (weight < 4) continue;
      scored.push({ ...e, score: weight, hits, topical: topical.filter((x) => text.includes(x)).length });
    }
  }
  scored.sort((a, b) => b.score - a.score || b.topical - a.topical);
  return scored.slice(0, limit);
}

// ─────────────────────── the news index, as last resort ───────────────────────

/** "Department of Justice (.gov)" -> "Department of Justice". */
function cleanPublisher(name) {
  return String(name || '')
    .replace(/\s*\([a-z.]{2,10}\)\s*$/i, '')
    .trim();
}

/** The index of every publisher, with the publisher's own address attached. */
async function feedItems(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchBody(url, { accept: 'application/rss+xml,application/xml,*/*', timeout: 20000 });
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const pick = (tag) => {
      const x = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return x ? x[1] : '';
    };
    const link = stripTags(pick('link'));
    const sourceUrl = (body.match(/<source[^>]+url="([^"]+)"/) || [])[1] || '';
    const title = stripTags(pick('title'));
    const seg = (link.match(/articles\/([^?]+)/) || [])[1] || '';
    if (!seg) continue;
    out.push({
      // The aggregator appends the publisher to the headline; the publisher
      // has its own field.
      title: title.replace(/\s[-–—]\s[^-–—]{2,60}$/, '').trim(),
      seg,
      sourceUrl,
      publisher: cleanPublisher(stripTags(pick('source'))),
      publishedAt: stripTags(pick('pubDate')) || null,
    });
  }
  return out;
}

/**
 * The index hides the publisher's address behind a token. This digs it out,
 * the way a reporter copies the address out of the link bar.
 */
async function decodeSegment(seg) {
  const splash = await fetchBody(`https://news.google.com/articles/${seg}`, {
    accept: 'text/html',
    timeout: 20000,
  });
  const ts = splash.match(/data-n-a-ts="([^"]+)"/)?.[1];
  const sg = splash.match(/data-n-a-sg="([^"]+)"/)?.[1];
  if (!ts || !sg) return null;

  const payload = JSON.stringify([
    'garturlreq',
    [
      ['en-US', 'US', ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'], null, null, 1, 1, 'US:en', null, 180, null, null, null, null, null, 0, null, null, [1608992183, 723341000]],
      'en-US', 'US', 1, [2, 3, 4, 8], 1, 0, '655000234', 0, 0, null, 0,
    ],
    seg,
    Number(ts),
    sg,
  ]);

  const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': UA },
    body: `f.req=${encodeURIComponent(JSON.stringify([[['Fbv4je', payload, null, 'generic']]]))}`,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const body = await res.text();
  const urls = body.match(/https?:\/\/[^\\"\s]+/g) || [];
  return urls.find((u) => !/google\.com|gstatic\.com|googleapis\.com/.test(u)) || null;
}

/**
 * Documents a question surfaces, with the address they really live at.
 * The registry first; the news index only for what the registry does not hold.
 *
 * @returns {Promise<{title:string,url:string,outlet:string,publisherUrl:string,publishedAt:string|null,primary:boolean,kind:string}[]>}
 */
export async function findDocuments(query, { limit = 6 } = {}) {
  const text = String(query || '').trim();
  const out = [];

  const filed = await institutionalDocuments(text, { maxInstitutions: 4, limit }).catch(() => []);
  for (const doc of filed) {
    out.push({
      title: doc.title,
      url: doc.url,
      outlet: doc.outlet,
      publisherUrl: null,
      publishedAt: doc.publishedAt,
      primary: true,
      kind: 'document',
    });
    if (out.length >= limit) return out;
  }

  const items = await feedItems(text).catch(() => []);
  const todo = items.slice(0, limit + 2);
  const decoded = await Promise.all(
    todo.map(async (it) => {
      const url = await decodeSegment(it.seg).catch(() => null);
      return { ...it, url: url || '' };
    })
  );
  for (const it of decoded) {
    if (!it.url) continue;
    out.push({
      title: it.title,
      url: it.url,
      outlet: it.publisher || hostOf(it.url),
      publisherUrl: it.sourceUrl,
      publishedAt: it.publishedAt,
      primary: true,
      kind: 'document',
    });
    if (out.length >= limit) break;
  }
  return out;
}
