// Which single source may carry a statistics snapshot on its own.
//
// PLAIN requires two independent outlets for every reported fact. Numbers are
// the exception the editor asked for: a figure is published or it is not, so
// one trustworthy source is enough. "Trustworthy" is not a judgement call by
// the model — it is this list, checked in code, so a random blog can never
// become the sole source of an election result.

const TRUSTED_HOSTS = [
  '.gov', '.gov.uk', '.gov.il', '.admin.ch', '.europa.eu',
  'bundeswahlleiterin.de', 'destatis.de', 'bfs.admin.ch', 'statistik.admin.ch',
  'eurostat.ec.europa.eu', 'ons.gov.uk', 'census.gov', 'bls.gov', 'bea.gov',
  'imf.org', 'worldbank.org', 'oecd.org', 'who.int', 'un.org', 'unhcr.org',
  'ourworldindata.org', 'pewresearch.org', 'gallup.com', 'knesset.gov.il',
  'elections.', 'reliefweb.int', 'acleddata.com', 'fec.gov',
];

const TRUSTED_OUTLETS = new Set([
  'reuters', 'associated press', 'ap', 'afp', 'dpa', 'bloomberg', 'bbc', 'cnbc',
]);

const extraHosts = () =>
  String(process.env.LIVE_STATS_TRUSTED || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/**
 * True when this single source may stand alone for a statistics snapshot.
 * Accepts official hosts (statistical offices, election commissions, central
 * banks, courts, agencies) and the major wire services by name.
 */
export function isTrustedStatsSource(src) {
  const outlet = String(src?.outlet || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (TRUSTED_OUTLETS.has(outlet)) return true;

  let host = '';
  try {
    host = new URL(src?.url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  if (!host) return false;

  return [...TRUSTED_HOSTS, ...extraHosts()].some((h) => {
    const k = h.replace(/^\./, '');
    if (host === k || host.endsWith(`.${k}`)) return true;
    // Entries ending in "." are fragments, e.g. "elections." for
    // elections.<something>.gov-style hosts.
    return h.endsWith('.') && host.includes(h);
  });
}

export const TRUSTED_STATS_CONFIG = { hosts: TRUSTED_HOSTS.length, outlets: [...TRUSTED_OUTLETS] };
