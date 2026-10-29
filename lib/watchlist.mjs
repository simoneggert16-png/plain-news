// Priority watchlist for the scouting layer.
//
// The desk is an LLM with a limited context window, so it only ever sees a
// subset of the hourly headlines. These patterns mark the stories that must
// never be dropped just because a category quota is full or because they were
// sorted behind ten football results. They are also the events that can become
// a live ticker.
//
// weight: 1 = worth watching, 3 = must not be missed.

export const WATCHLIST = [
  {
    id: 'israel-election',
    weight: 3,
    live: true,
    label: { en: 'Israel election', de: 'Israel-Wahl' },
    re: /\bisrael\w*\b[^.|]{0,80}\b(election|elections|vote|votes|voting|ballot|knesset|coalition|poll|polls|government)\b|\bknesset\b|\blikud\b|\bnetanyahu\b[^.|]{0,60}\b(election|vote|coalition|government|indictment|trial)\b/i,
  },
  {
    id: 'gaza',
    weight: 3,
    live: true,
    label: { en: 'Gaza / Middle East war', de: 'Gaza / Nahost-Krieg' },
    re: /\b(gaza|rafah|west bank|hezbollah|houthi|hamas)\b/i,
  },
  {
    id: 'ukraine-war',
    weight: 3,
    live: true,
    label: { en: 'Ukraine war', de: 'Ukraine-Krieg' },
    re: /\b(ukraine|ukrainian|kyiv|kiev|zelensk\w*|kharkiv|odesa|donbas|crimea)\b/i,
  },
  {
    id: 'iran',
    weight: 3,
    live: true,
    label: { en: 'Iran', de: 'Iran' },
    re: /\biran\w*\b[^.|]{0,60}\b(strike|strikes|attack|nuclear|uranium|enrichment|sanctions|tehran|khamenei)\b|\b(tehran|khamenei|irgc)\b/i,
  },
  {
    id: 'us-election',
    weight: 3,
    live: true,
    label: { en: 'US election', de: 'US-Wahl' },
    re: /\b(midterm|midterms|electoral college|swing state|ballot|primary election)\b|\b(congress|senate|house)\b[^.|]{0,50}\b(election|seat|majority|vote)\b/i,
  },
  {
    id: 'election-generic',
    weight: 2,
    live: true,
    label: { en: 'Election', de: 'Wahl' },
    // Broad on purpose: the desk decides whether the cluster is one event.
    // The old pattern only matched "national election", "presidential
    // election" etc., so a plain "Lula wins Brazil election" fell through and
    // no ticker was ever opened for it.
    re: /\b(elections?|elected|runoff|referendum|ballot|votes? count|polling stations?|coalition talks?)\b/i,
  },
  {
    id: 'latam-politics',
    weight: 3,
    live: true,
    label: { en: 'Latin America', de: 'Lateinamerika' },
    re: /\b(brazil|brasil|lula|bolsonaro|mexico|sheinbaum|argentina|milei|chile|colombia|peru|venezuela|maduro|bolivia|ecuador|uruguay|paraguay)\b[^.|]{0,70}\b(election|elections|elected|vote|votes|ballot|runoff|inauguration|impeachment|coup|protest|strike)\b/i,
  },
  {
    id: 'swiss-vote',
    weight: 2,
    live: true,
    label: { en: 'Swiss vote', de: 'Schweizer Abstimmung' },
    re: /\b(abstimmung|volksabstimmung|stimmbeteiligung|referendum|bundesrat|nationalrat|ständerat|eidgenoss\w*)\b/i,
  },
  {
    id: 'disaster',
    weight: 3,
    live: true,
    label: { en: 'Natural disaster', de: 'Naturkatastrophe' },
    // "landslide victory" is an election metaphor; only a landslide that
    // kills or buries people is a disaster.
    re: /\b(earthquake|tsunami|hurricane|typhoon|cyclone|volcano|eruption|wildfire|flash flood|magnitude \d)\b|\b(landslide|mudslide)\b[^.|]{0,40}\b(kill|killed|dead|death|bury|buried|missing|rescue|evacuat)/i,
  },
  {
    id: 'attack',
    weight: 3,
    live: true,
    label: { en: 'Attack', de: 'Anschlag' },
    re: /\b(terror attack|terrorist attack|mass shooting|hostage|bombing|explosion|assassination|gunman|stabbing attack)\b/i,
  },
  {
    id: 'coup',
    weight: 3,
    live: true,
    label: { en: 'Coup / state crisis', de: 'Putsch / Staatskrise' },
    re: /\b(coup|martial law|state of emergency|military takeover|junta|impeachment)\b/i,
  },
  {
    id: 'central-bank',
    weight: 2,
    live: true,
    label: { en: 'Central bank decision', de: 'Notenbank-Entscheid' },
    re: /\b(federal reserve|fed|ecb|european central bank|bank of england|bank of japan|snb|swiss national bank)\b[^.|]{0,60}\b(rate|rates|interest|decision|cut|hike|hold)\b/i,
  },
  {
    id: 'plane-crash',
    weight: 3,
    live: true,
    label: { en: 'Aviation accident', de: 'Flugzeugunglück' },
    re: /\b(plane crash|air crash|airliner|flight \w{2}\d+|boeing|airbus)\b[^.|]{0,50}\b(crash|crashed|missing|emergency landing)\b/i,
  },
  {
    id: 'nuclear',
    weight: 3,
    live: true,
    label: { en: 'Nuclear', de: 'Atom' },
    re: /\b(nuclear (test|weapon|plant|reactor|program)|enrichment|iaea|radioactive|meltdown)\b/i,
  },
  {
    id: 'health-emergency',
    weight: 3,
    live: true,
    label: { en: 'Health emergency', de: 'Gesundheitsnotlage' },
    re: /\b(who)\b[^.|]{0,50}\b(emergency|outbreak|pandemic|alert)\b|\b(outbreak|epidemic|pandemic|bird flu|mpox|ebola|measles)\b/i,
  },
  {
    id: 'top-office',
    weight: 2,
    live: true,
    label: { en: 'Head of state / government', de: 'Staats- und Regierungschef' },
    re: /\b(president|prime minister|chancellor|king|queen|pope)\b[^.|]{0,50}\b(dies|died|dead|resigns|resigned|steps down|ousted|hospitali[sz]ed)\b/i,
  },
  {
    id: 'courts',
    weight: 2,
    live: true,
    label: { en: 'Major ruling', de: 'Grundsatzurteil' },
    re: /\b(supreme court|constitutional court|high court|tribunal|verdict|ruling)\b[^.|]{0,60}\b(ban|uphold|strike down|order|sentence|convict|acquit)\b/i,
  },
  {
    id: 'markets-shock',
    weight: 2,
    live: false,
    label: { en: 'Market shock', de: 'Marktschock' },
    re: /\b(stock market|markets)\b[^.|]{0,60}\b(crash|plunge|selloff|sell-off|record high|halted|circuit breaker)\b|\b(bitcoin|oil price)\b[^.|]{0,40}\b(plunge|surge|record)\b/i,
  },
  {
    id: 'ai-frontier',
    weight: 1,
    live: false,
    label: { en: 'AI frontier', de: 'KI-Durchbruch' },
    re: /\b(openai|anthropic|deepmind|nvidia)\b[^.|]{0,60}\b(launch|release|model|breakthrough|lawsuit|ban)\b/i,
  },
];

/** All watchlist hits in a text, strongest first. */
export function watchHits(text = '') {
  const hits = [];
  for (const w of WATCHLIST) if (w.re.test(text)) hits.push(w);
  return hits.sort((a, b) => b.weight - a.weight);
}

/** Highest watchlist weight (0 = not on the list). */
export function watchScore(text = '') {
  const hits = watchHits(text);
  return hits.length ? hits[0].weight : 0;
}

/** Could this headline belong to an event that deserves its own live ticker? */
export function isLiveWorthy(text = '') {
  return watchHits(text).some((w) => w.live);
}

export function watchLabel(text = '', locale = 'en') {
  const hit = watchHits(text)[0];
  return hit ? hit.label[locale] || hit.label.en : null;
}
