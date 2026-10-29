// Deliberately diverse: public broadcasters, wire-style outlets, left- and right-leaning papers,
// non-Western newsrooms, regional specialists for the watchlist regions and official
// primary sources (central banks, IAEA, courts, statistical agencies).
// A story needs â‰¥2 DIFFERENT outlets to be published.
export const FEEDS = [
  // â”€â”€ Public broadcasters / international
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml' },
  { outlet: 'BBC', url: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { outlet: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { outlet: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml' },   // World
  { outlet: 'NPR', url: 'https://feeds.npr.org/1014/rss.xml' },  // Politics
  { outlet: 'NPR', url: 'https://feeds.npr.org/1006/rss.xml' },  // Business
  { outlet: 'NPR', url: 'https://feeds.npr.org/1019/rss.xml' },  // Technology
  { outlet: 'NPR', url: 'https://feeds.npr.org/1027/rss.xml' },  // Science
  { outlet: 'NPR', url: 'https://feeds.npr.org/1128/rss.xml' },  // Health
  { outlet: 'DW', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { outlet: 'France 24', url: 'https://www.france24.com/en/rss' },
  { outlet: 'France 24', url: 'https://www.france24.com/en/middle-east/rss' },
  { outlet: 'Euronews', url: 'https://www.euronews.com/rss' },
  { outlet: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { outlet: 'CBC', url: 'https://www.cbc.ca/webfeed/rss/rss-world' },
  { outlet: 'ABC Australia', url: 'https://www.abc.net.au/news/feed/51120/rss.xml' },
  { outlet: 'Tagesschau', url: 'https://www.tagesschau.de/index~rss2.xml' },
  { outlet: 'ZDF heute', url: 'https://www.zdf.de/rss/zdf/nachrichten', optional: true },
  { outlet: 'Die Zeit', url: 'https://newsfeed.zeit.de/index' },
  { outlet: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml' },
  // Constructive / solutions journalism. Flagged so the source policy can
  // accept them as a single source: their stories are original reporting that
  // no second outlet picks up, but they are exactly the counterweight the
  // homepage needs.
  { outlet: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/', positive: true },
  { outlet: 'Positive News', url: 'https://www.positive.news/feed/', positive: true },
  { outlet: 'Reasons to Be Cheerful', url: 'https://reasonstobecheerful.world/feed/', positive: true },
  { outlet: 'The Optimist Daily', url: 'https://www.optimistdaily.com/feed/', positive: true },

  // â”€â”€ Newspapers across the spectrum
  { outlet: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { outlet: 'The Guardian', url: 'https://www.theguardian.com/environment/rss' },
  { outlet: 'The Guardian', url: 'https://www.theguardian.com/uk/sport/rss' },
  { outlet: 'The Guardian', url: 'https://www.theguardian.com/politics/rss' },
  { outlet: 'The Guardian', url: 'https://www.theguardian.com/uk/business/rss' },
  { outlet: 'The Guardian', url: 'https://www.theguardian.com/society/health/rss' },
  { outlet: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { outlet: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml' },
  { outlet: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml' },
  { outlet: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml' },
  { outlet: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { outlet: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml' },
  { outlet: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
  { outlet: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { outlet: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/world.xml' },
  { outlet: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/politics.xml' },
  { outlet: 'The Hill', url: 'https://thehill.com/feed/' },
  { outlet: 'Axios', url: 'https://api.axios.com/feed/' },
  { outlet: 'Semafor', url: 'https://www.semafor.com/rss.xml' },
  { outlet: 'Politico Europe', url: 'https://www.politico.eu/feed/' },
  { outlet: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
  { outlet: 'Times of Israel', url: 'https://www.timesofisrael.com/feed/' },
  { outlet: 'Haaretz', url: 'https://www.haaretz.com/srv/htz---all-articles/rss' },
  { outlet: 'Dawn', url: 'https://www.dawn.com/feeds/home' },
  { outlet: 'Der Spiegel', url: 'https://www.spiegel.de/schlagzeilen/index.rss' },
  { outlet: 'FAZ', url: 'https://www.faz.net/rss/aktuell/' },
  { outlet: 'Die Welt', url: 'https://www.welt.de/feeds/latest.rss' },
  { outlet: 'Le Monde', url: 'https://www.lemonde.fr/en/rss/une.xml' },
  { outlet: 'El PaÃ­s', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada' },
  { outlet: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/world.xml' },
  { outlet: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss' },
  { outlet: 'Africanews', url: 'https://www.africanews.com/feed/rss' },

  // â”€â”€ Switzerland (home market)
  // market: 'ch' marks the desk's own beat — the investigate bot reads these
  // feeds directly because Google News returns almost nothing from CI runners.
  { outlet: 'SRF', url: 'https://www.srf.ch/news/bnf/rss/1646', market: 'ch' },
  { outlet: 'NZZ', url: 'https://www.nzz.ch/recent.rss', market: 'ch' },
  { outlet: 'Tages-Anzeiger', url: 'https://www.tagesanzeiger.ch/rss.html', market: 'ch' },
  { outlet: 'Le Temps', url: 'https://www.letemps.ch/rss', market: 'ch' },
  { outlet: 'SWI swissinfo', url: 'https://www.swissinfo.ch/eng/latest-news/rss', market: 'ch' },

  // â”€â”€ Asia
  { outlet: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed' },
  { outlet: 'The Japan Times', url: 'https://www.japantimes.co.jp/feed/' },
  { outlet: 'Yonhap', url: 'https://en.yna.co.kr/RSS/news.xml' },
  { outlet: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { outlet: 'The Hindu', url: 'https://www.thehindu.com/news/international/feeder/default.rss' },
  { outlet: 'NHK World', url: 'https://www3.nhk.or.jp/nhkworld/en/news/rss/all.xml' },
  { outlet: 'CNA', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml' },

  // â”€â”€ Latin America / Africa: the blind spots of the German wire
  { outlet: 'G1', url: 'https://g1.globo.com/rss/g1/' },
  { outlet: 'AgÃªncia Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml' },
  { outlet: 'Folha', url: 'https://feeds.folha.uol.com.br/mundo/rss.xml' },
  { outlet: 'El Universal', url: 'https://www.eluniversal.com.mx/rss.xml' },
  { outlet: 'Buenos Aires Times', url: 'https://www.batimes.com.ar/feed' },
  { outlet: 'Mail & Guardian', url: 'https://mg.co.za/feed/' },
  { outlet: 'AllAfrica', url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf' },
  { outlet: 'Africanews', url: 'https://www.africanews.com/feed/rss' },
  { outlet: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar', optional: true },
  { outlet: 'The Straits Times', url: 'https://www.straitstimes.com/news/world/rss.xml', optional: true },

  // â”€â”€ Regional specialists for the watchlist regions
  { outlet: 'The Times of Israel', url: 'https://www.timesofisrael.com/feed/' },
  { outlet: 'The Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx' },
  { outlet: 'Haaretz', url: 'https://www.haaretz.com/cmlink/1.628765', optional: true },
  { outlet: 'Al Arabiya English', url: 'https://english.alarabiya.net/tools/rss', optional: true },
  { outlet: 'The National', url: 'https://www.thenationalnews.com/rss/', optional: true },
  { outlet: 'Kyiv Independent', url: 'https://kyivindependent.com/feed/', optional: true },
  { outlet: 'The Kyiv Post', url: 'https://www.kyivpost.com/feed', optional: true },

  // â”€â”€ Official primary sources (allowed as a single source)
  { outlet: 'European Central Bank', url: 'https://www.ecb.europa.eu/rss/press.html' },
  { outlet: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { outlet: 'IAEA', url: 'https://www.iaea.org/feeds/topstories', optional: true },
  { outlet: 'WHO', url: 'https://www.who.int/rss-feeds/news-english.xml' },
  { outlet: 'NASA', url: 'https://www.nasa.gov/feed/' },
  { outlet: 'ESA', url: 'https://www.esa.int/rssfeed/Our_Activities/Space_News' },

  // â”€â”€ Business / tech / science / sport & live feeds
  { outlet: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { outlet: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { outlet: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { outlet: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { outlet: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { outlet: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { outlet: 'Nature', url: 'https://www.nature.com/nature.rss' },
  { outlet: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/top.xml' },
  { outlet: 'Science News', url: 'https://www.sciencenews.org/feed' },
  { outlet: 'Quanta Magazine', url: 'https://www.quantamagazine.org/feed/' },
  { outlet: 'Phys.org', url: 'https://phys.org/rss-feed/' },
  { outlet: 'Science', url: 'https://www.science.org/rss/news_current.xml' },
  { outlet: 'New Scientist', url: 'https://www.newscientist.com/feed/home/' },
  { outlet: 'Live Science', url: 'https://www.livescience.com/feeds/all' },
  { outlet: 'Space.com', url: 'https://www.space.com/feeds/all' },
  { outlet: 'InsideClimate News', url: 'https://insideclimatenews.org/feed/' },
  { outlet: 'Mongabay', url: 'https://news.mongabay.com/feed/' },
  { outlet: 'Copernicus', url: 'https://climate.copernicus.eu/rss.xml' },
  { outlet: 'Yale Climate Connections', url: 'https://yaleclimateconnections.org/feed/' },
  { outlet: 'Climate Home News', url: 'https://www.climatechangenews.com/feed/' },
  { outlet: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
  { outlet: 'Carbon Brief', url: 'https://www.carbonbrief.org/feed/' },
  { outlet: 'Medical News Today', url: 'https://rss.medicalnewstoday.com/featurednews.xml' },
  { outlet: 'STAT News', url: 'https://www.statnews.com/feed/' },
  { outlet: 'Healthline', url: 'https://www.healthline.com/rss/health-news' },
  { outlet: 'MedicalXpress', url: 'https://medicalxpress.com/rss-feed/' },
  { outlet: 'BBC Culture', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  { outlet: 'The Guardian Culture', url: 'https://www.theguardian.com/culture/rss' },
  { outlet: 'NPR Arts', url: 'https://feeds.npr.org/1008/rss.xml' },
  { outlet: 'Variety', url: 'https://variety.com/feed/' },
  { outlet: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/' },
  { outlet: 'ARTnews', url: 'https://www.artnews.com/feed/' },
  { outlet: 'Pitchfork', url: 'https://pitchfork.com/rss/news/' },
  { outlet: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/' },
  { outlet: 'DW', url: 'https://rss.dw.com/rdf/rss-en-cul' },
  { outlet: 'Le Monde', url: 'https://www.lemonde.fr/culture/rss_full.xml' },
  { outlet: 'ESPN', url: 'https://www.espn.com/espn/rss/news' },
  { outlet: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' },
  { outlet: 'ESPN', url: 'https://www.espn.com/espn/rss/nba/news' },
  { outlet: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/' },
  { outlet: 'Marca', url: 'https://e00-marca.uecdn.es/rss/portada.xml' },
  { outlet: 'Sky Sports', url: 'https://www.skysports.com/rss/12040' },
  { outlet: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { outlet: 'BBC Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { outlet: 'Kicker', url: 'https://newsfeed.kicker.de/news/aktuell' },
  { outlet: 'Sportschau', url: 'https://www.sportschau.de/index~rss2.xml' },
  { outlet: 'Eurosport', url: 'https://www.eurosport.com/rss.xml' },
];

/**
 * Topic radar: Google News search feeds for the watchlist regions.
 *
 * This is the safety net against "we missed the biggest story". Google News
 * aggregates dozens of publishers per query, and the feed layer strips the
 * " - Publisher" suffix and uses the real publisher as the outlet, so these
 * still count as independent sources (never as "Google News").
 *
 * `when:1d` keeps the volume sane; the query itself must stay broad enough to
 * catch rolling coverage of an ongoing event.
 */
const RADAR_QUERIES = [
  ['israel election', '(Israel OR Knesset) (election OR vote OR coalition OR Netanyahu) when:2d'],
  ['gaza', 'Gaza when:1d'],
  ['ukraine', 'Ukraine (war OR strike OR offensive OR peace) when:1d'],
  ['iran', 'Iran (nuclear OR strike OR sanctions OR uranium) when:2d'],
  ['us politics', '(US Congress OR Senate OR White House OR midterms) when:1d'],
  ['elections', '(election result OR runoff OR coalition talks OR referendum) when:1d'],
  ['swiss vote', '(Abstimmung OR Volksabstimmung OR Bundesrat Schweiz) when:2d'],
  ['disasters', '(earthquake OR tsunami OR hurricane OR typhoon OR wildfire OR "flash flood") when:1d'],
  ['central banks', '("central bank" OR ECB OR "Federal Reserve" OR SNB) (rate decision OR interest rate) when:2d'],
  ['breaking world', '("state of emergency" OR coup OR "mass shooting" OR "plane crash") when:1d'],
];

const radarFeeds = RADAR_QUERIES.map(([label, query]) => ({
  outlet: `Radar: ${label}`,
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
  kind: 'aggregator',
  via: 'Google News',
}));

FEEDS.push(...radarFeeds);

/** Feeds that are not news outlets themselves (aggregators) â€” for logging only. */
export const FEED_STATS = {
  outlets: new Set(FEEDS.map((f) => f.outlet)).size,
  feeds: FEEDS.length,
  radar: radarFeeds.length,
};
