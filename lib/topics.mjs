// Central Comprehensive Topics & Beats Catalogue for PLAIN

export const ALL_BEATS = [
  // Core Categories
  { id: 'world', cat: 'Kern', labelDe: 'Weltpolitik', labelEn: 'World Politics' },
  { id: 'politics', cat: 'Kern', labelDe: 'Bundeshaus & Schweiz', labelEn: 'Swiss & Global Politics' },
  { id: 'business', cat: 'Kern', labelDe: 'Wirtschaft & Märkte', labelEn: 'Business & Markets' },
  { id: 'tech', cat: 'Kern', labelDe: 'Technologie & Software', labelEn: 'Technology & Software' },
  { id: 'science', cat: 'Kern', labelDe: 'Wissenschaft & Physik', labelEn: 'Science & Physics' },
  { id: 'climate', cat: 'Kern', labelDe: 'Klima & Alpengletscher', labelEn: 'Climate & Glaciers' },
  { id: 'health', cat: 'Kern', labelDe: 'Gesundheit & Medizin', labelEn: 'Health & Medicine' },
  { id: 'culture', cat: 'Kern', labelDe: 'Kultur & Gesellschaft', labelEn: 'Culture & Arts' },
  { id: 'sport', cat: 'Kern', labelDe: 'Allgemeiner Sport', labelEn: 'General Sports' },

  // Sport Beats
  { id: 'football', cat: 'Sport', labelDe: 'Fussball (Super League, CL, EM)', labelEn: 'Football / Soccer' },
  { id: 'motorsport', cat: 'Sport', labelDe: 'Formel 1 & Rennsport', labelEn: 'Formula 1 & Racing' },
  { id: 'tennis', cat: 'Sport', labelDe: 'Tennis & Grand Slams', labelEn: 'Tennis & ATP/WTA' },
  { id: 'ski', cat: 'Sport', labelDe: 'Ski Alpin & Wintersport', labelEn: 'Alpine Skiing & Winter Sports' },
  { id: 'icehockey', cat: 'Sport', labelDe: 'Eishockey (National League)', labelEn: 'Ice Hockey' },

  // Tech, AI & Science Beats
  { id: 'ai', cat: 'Tech & Science', labelDe: 'KI & Halbleiter', labelEn: 'AI & Chips' },
  { id: 'space', cat: 'Tech & Science', labelDe: 'Raumfahrt & CERN', labelEn: 'Space & Astrophysics' },
  { id: 'cyber', cat: 'Tech & Science', labelDe: 'Cyber-Sicherheit & Hacking', labelEn: 'Cybersecurity & Privacy' },
  { id: 'biotech', cat: 'Tech & Science', labelDe: 'Pharma & Biotechnologie', labelEn: 'Pharma & Biotech' },

  // Finance, Economy & Swiss Beats
  { id: 'snb', cat: 'Wirtschaft', labelDe: 'SNB & Zinspolitik', labelEn: 'SNB & Monetary Policy' },
  { id: 'crypto', cat: 'Wirtschaft', labelDe: 'Fintech & Krypto', labelEn: 'Fintech & Digital Assets' },
  { id: 'realestate', cat: 'Wirtschaft', labelDe: 'Immobilien & Wohnen', labelEn: 'Real Estate & Housing' },
  { id: 'energy', cat: 'Wirtschaft', labelDe: 'Energie & Kernkraft', labelEn: 'Energy & Power Grids' },
  { id: 'defense', cat: 'Politik', labelDe: 'Schweizer Armee & Geopolitik', labelEn: 'Swiss Defense & NATO' },
  { id: 'watches', cat: 'Kultur', labelDe: 'Schweizer Uhren & Luxus', labelEn: 'Swiss Watches & Luxury' },
];

export const DEFAULT_ACTIVE_TOPICS = [
  'world', 'politics', 'business', 'tech', 'science', 'climate', 'health', 'culture', 'sport'
];
