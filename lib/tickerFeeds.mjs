// Shared RSS layer for both ticker endpoints.
//
// The ticker used to be fed by German football feeds only, so a Brazilian
// presidential election never showed up next to the sports results. A ticker
// is supposed to be a wire: world, politics, business, tech, sport and a
// little bit of good news, newest first.

import Parser from 'rss-parser';

const UA = 'Mozilla/5.0 (compatible; PlainNewsTicker/1.0; +https://www.plain-news.ch)';

const parser = new Parser({
  timeout: 6000,
  headers: {
    'User-Agent': UA,
    Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  },
});

// ── News feeds ───────────────────────────────────────────────────────────
// `desk` maps a feed onto one of the ticker filters used by the UI
// (world, politics, business, tech, science) and `lang` lets German headlines
// win when the same event is covered twice.
export const NEWS_FEEDS = [
  // German-language wires first: the ticker is German by default.
  { outlet: 'Tagesschau', url: 'https://www.tagesschau.de/xml/rss2', desk: 'world', lang: 'de' },
  { outlet: 'Tagesschau', url: 'https://www.tagesschau.de/ausland/rss2.xml', desk: 'world', lang: 'de' },
  { outlet: 'DW', url: 'https://rss.dw.com/rdf/rss-de-all', desk: 'world', lang: 'de' },
  { outlet: 'ZDF heute', url: 'https://www.zdf.de/rss/zdf/nachrichten', desk: 'world', lang: 'de' },
  { outlet: 'Spiegel', url: 'https://www.spiegel.de/schlagzeilen/index.rss', desk: 'world', lang: 'de' },
  { outlet: 'ZEIT', url: 'https://newsfeed.zeit.de/index', desk: 'world', lang: 'de' },
  { outlet: 'Süddeutsche', url: 'https://rss.sueddeutsche.de/rss/Topthemen', desk: 'world', lang: 'de' },
  { outlet: 'ORF', url: 'https://rss.orf.at/news.xml', desk: 'world', lang: 'de' },
  { outlet: 'NZZ', url: 'https://www.nzz.ch/recent.rss', desk: 'world', lang: 'de' },

  // International wires / public broadcasters
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', desk: 'world', lang: 'en' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', desk: 'politics', lang: 'en' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', desk: 'business', lang: 'en' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', desk: 'tech', lang: 'en' },
  { outlet: 'Guardian', url: 'https://www.theguardian.com/world/rss', desk: 'world', lang: 'en' },
  { outlet: 'Guardian', url: 'https://www.theguardian.com/politics/rss', desk: 'politics', lang: 'en' },
  { outlet: 'Guardian', url: 'https://www.theguardian.com/uk/business/rss', desk: 'business', lang: 'en' },
  { outlet: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', desk: 'business', lang: 'en' },
  { outlet: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', desk: 'business', lang: 'en' },
  { outlet: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/schlagzeilen', desk: 'business', lang: 'de' },
  { outlet: 'NPR', url: 'https://feeds.npr.org/1006/rss.xml', desk: 'business', lang: 'en' },
  { outlet: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', desk: 'tech', lang: 'en' },
  { outlet: 'Heise', url: 'https://www.heise.de/rss/heise-atom.xml', desk: 'tech', lang: 'de' },
  { outlet: 'Nature', url: 'https://www.nature.com/nature.rss', desk: 'science', lang: 'en' },
  { outlet: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/top.xml', desk: 'science', lang: 'en' },
  { outlet: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', desk: 'world', lang: 'en' },
  { outlet: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml', desk: 'world', lang: 'en' },
  { outlet: 'NPR', url: 'https://feeds.npr.org/1014/rss.xml', desk: 'politics', lang: 'en' },
  { outlet: 'France 24', url: 'https://www.france24.com/en/rss', desk: 'world', lang: 'en' },

  // Regional wires — the stories German desks routinely miss.
  { outlet: 'G1', url: 'https://g1.globo.com/rss/g1/', desk: 'world', lang: 'pt' },
  { outlet: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', desk: 'world', lang: 'pt' },
  { outlet: 'Folha', url: 'https://feeds.folha.uol.com.br/mundo/rss.xml', desk: 'world', lang: 'pt' },
  { outlet: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', desk: 'world', lang: 'es' },
  { outlet: 'El Universal', url: 'https://www.eluniversal.com.mx/rss.xml', desk: 'world', lang: 'es' },
  { outlet: 'SCMP', url: 'https://www.scmp.com/rss/91/feed', desk: 'world', lang: 'en' },
  { outlet: 'The Hindu', url: 'https://www.thehindu.com/news/international/feeder/default.rss', desk: 'world', lang: 'en' },
  { outlet: 'NHK World', url: 'https://www3.nhk.or.jp/nhkworld/en/news/rss/all.xml', desk: 'world', lang: 'en' },
  { outlet: 'Mail & Guardian', url: 'https://mg.co.za/feed/', desk: 'world', lang: 'en' },
  { outlet: 'AllAfrica', url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', desk: 'world', lang: 'en' },

  // Constructive / solutions journalism
  { outlet: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/', desk: 'world', lang: 'en', positive: true },
  { outlet: 'Positive News', url: 'https://www.positive.news/feed/', desk: 'world', lang: 'en', positive: true },
  { outlet: 'Reasons to Be Cheerful', url: 'https://reasonstobecheerful.world/feed/', desk: 'world', lang: 'en', positive: true },
  { outlet: 'The Optimist Daily', url: 'https://www.optimistdaily.com/feed/', desk: 'world', lang: 'en', positive: true },
];

// ── Sport feeds ──────────────────────────────────────────────────────────
export const SPORT_FEEDS = [
  { outlet: 'Kicker', url: 'https://newsfeed.kicker.de/news/fussball', sportType: 'football' },
  { outlet: 'Sportschau', url: 'https://www.sportschau.de/fussball/index~rss2.xml', sportType: 'football' },
  { outlet: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', sportType: 'football' },
  { outlet: 'Sportschau', url: 'https://www.sportschau.de/tennis/index~rss2.xml', sportType: 'tennis' },
  { outlet: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', sportType: 'tennis' },
  { outlet: 'Sportschau', url: 'https://www.sportschau.de/motorsport/index~rss2.xml', sportType: 'f1' },
  { outlet: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', sportType: 'f1' },
  { outlet: 'Sportschau', url: 'https://www.sportschau.de/basketball/index~rss2.xml', sportType: 'basketball' },
  { outlet: 'Sportschau', url: 'https://www.sportschau.de/american-football/index~rss2.xml', sportType: 'nfl' },
  { outlet: 'Sportschau', url: 'https://www.sportschau.de/eishockey/index~rss2.xml', sportType: 'eishockey' },
  { outlet: 'Sportschau', url: 'https://www.sportschau.de/radsport/index~rss2.xml', sportType: 'cycling' },
  { outlet: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/golf/rss.xml', sportType: 'golf' },
  { outlet: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml', sportType: 'cricket' },
];

const BADGES = {
  football: 'FUSSBALL',
  f1: 'FORMEL 1',
  eishockey: 'EISHOCKEY',
  basketball: 'BASKETBALL',
  nfl: 'NFL',
  tennis: 'TENNIS',
  cycling: 'RADSPORT',
  golf: 'GOLF',
  cricket: 'CRICKET',
  world: 'WELT',
  politics: 'POLITIK',
  business: 'WIRTSCHAFT',
  tech: 'TECH',
  science: 'WISSEN',
  culture: 'KULTUR',
  health: 'GESUNDHEIT',
  climate: 'KLIMA',
};

const JUNK = /(quiz|crossword|wordle|horoscope|podcast|newsletter|sponsored|deals? of the day|best .* to buy|opinion|op-ed|kommentar|meinung|editorial:|analyse:|letters:|in pictures|watch:|video:|gallery|liveblog:|última hora|en directo|zona eleitoral|resultado da vota|seção eleitoral)/i;

// Generic feed titles that carry no news value ("Schlagzeilen", "Top stories").
const GENERIC = /^(schlagzeilen|nachrichten|aktuelle nachrichten|top ?stories|latest news|news headlines|headlines|breaking news|home|startseite)$/i;

// Service journalism that reads like news but is not ("What to expect on election day").
const SERVICE = /(ready to vote\?|what to expect on|how to vote|wahl-o-mat|everything you need to know|a guide to)/i;

export const clean = (s = '') =>
  String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const cleanTitle = (s = '') =>
  clean(s)
    .replace(/^\s*(?:LIVE!?|Jetzt live|Im Liveblog|Live-Ticker)\s*[-–—:]?\s*/i, '')
    .replace(/^\s*(?:MELDUNGEN|NACHRICHTEN)\s+[A-ZÄÖÜ]+\s*[-–—:]\s*/, '')
    .trim();

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'after', 'before',
  'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'says', 'say',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'und', 'oder', 'zu',
  'im', 'in', 'am', 'an', 'auf', 'für', 'mit', 'nach', 'vor', 'bei', 'von', 'aus', 'als',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'sagt', 'sagen', 'um', 'über',
]);

/** Rough cross-outlet signature: same event, different word order. */
export function signature(title = '') {
  return clean(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 6)
    .sort()
    .join('-');
}

function itemTime(item) {
  const raw = item.isoDate || item.pubDate || item.date || '';
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/**
 * Fetch every feed in parallel and return normalized, de-duplicated ticker
 * items sorted newest first. Failures are ignored per feed.
 */
export async function fetchTickerFeeds({
  maxAgeHours = 48,
  perFeed = 6,
  now = Date.now(),
  includeSport = true,
  includePositive = true,
  // The ticker publishes German/English headlines; regional-language feeds are
  // still listed above for scouting, but are not mixed into the German wire.
  languages = ['de', 'en'],
} = {}) {
  const feeds = [
    ...NEWS_FEEDS.filter((f) => (includePositive || !f.positive)
      && (!languages || !f.lang || languages.includes(f.lang))),
    ...(includeSport ? SPORT_FEEDS : []),
  ];
  const cutoff = now - maxAgeHours * 3600e3;
  const settled = await Promise.allSettled(
    feeds.map(async (feed) => ({ feed, parsed: await parser.parseURL(feed.url) })),
  );

  const items = [];
  const seen = new Set();

  for (const res of settled) {
    if (res.status !== 'fulfilled') continue;
    const { feed, parsed } = res.value;
    const feedItems = (parsed.items || []).slice(0, perFeed);

    for (let idx = 0; idx < feedItems.length; idx++) {
      const raw = feedItems[idx];
      const title = cleanTitle(raw.title || '');
      if (!title || JUNK.test(title) || GENERIC.test(title) || SERVICE.test(title)) continue;

      const published = itemTime(raw);
      // Undated items are dropped: stamping them with "now" is what pinned a
      // finished farewell match to the top of the ticker for days.
      if (published === null || published < cutoff || published > now + 3600e3) continue;

      const sig = signature(title);
      if (!sig || seen.has(sig)) continue;
      seen.add(sig);

      const positive = Boolean(feed.positive);
      const isSport = Boolean(feed.sportType);
      const isLive = isSport && /live|halbzeit|endstand|führt|tor|spieltag|remis|final/i.test(title);
      const badge = isSport
        ? (isLive ? 'LIVE' : BADGES[feed.sportType] || 'SPORT')
        : positive
          ? 'GUTE NACHRICHTEN'
          : BADGES[feed.desk] || 'WELT';

      items.push({
        id: `${feed.outlet.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${published}-${idx}`,
        time: new Date(published).toISOString(),
        type: isSport ? 'sport' : feed.desk || 'world',
        sportType: isSport ? feed.sportType : null,
        badge,
        isLive,
        positive,
        title,
        detail: raw.contentSnippet ? clean(raw.contentSnippet).slice(0, 180) : null,
        url: raw.link || null,
        source: feed.outlet,
        lang: feed.lang || null,
      });
    }
  }

  items.sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || a.id.localeCompare(b.id));
  return items;
}
