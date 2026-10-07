// Central Comprehensive Topics & Beats Catalogue for PLAIN

export const ALL_BEATS = [
  // Core Categories
  { id: 'world', cat: 'Kern', labelDe: 'Weltpolitik', labelEn: 'World Politics', icon: '🌍' },
  { id: 'politics', cat: 'Kern', labelDe: 'Bundeshaus & Schweiz', labelEn: 'Swiss & Global Politics', icon: '🏛️' },
  { id: 'business', cat: 'Kern', labelDe: 'Wirtschaft & Märkte', labelEn: 'Business & Markets', icon: '📈' },
  { id: 'tech', cat: 'Kern', labelDe: 'Technologie & Software', labelEn: 'Technology & Software', icon: '💻' },
  { id: 'science', cat: 'Kern', labelDe: 'Wissenschaft & Physik', labelEn: 'Science & Physics', icon: '🔬' },
  { id: 'climate', cat: 'Kern', labelDe: 'Klima & Alpengletscher', labelEn: 'Climate & Glaciers', icon: '🏔️' },
  { id: 'health', cat: 'Kern', labelDe: 'Gesundheit & Medizin', labelEn: 'Health & Medicine', icon: '🩺' },
  { id: 'culture', cat: 'Kern', labelDe: 'Kultur & Gesellschaft', labelEn: 'Culture & Arts', icon: '🎭' },
  { id: 'sport', cat: 'Kern', labelDe: 'Allgemeiner Sport', labelEn: 'General Sports', icon: '🏅' },

  // Sport Beats
  { id: 'football', cat: 'Sport', labelDe: 'Fussball (Super League, CL, EM)', labelEn: 'Football / Soccer', icon: '⚽' },
  { id: 'motorsport', cat: 'Sport', labelDe: 'Formel 1 & Rennsport', labelEn: 'Formula 1 & Racing', icon: '🏎️' },
  { id: 'tennis', cat: 'Sport', labelDe: 'Tennis & Grand Slams', labelEn: 'Tennis & ATP/WTA', icon: '🎾' },
  { id: 'ski', cat: 'Sport', labelDe: 'Ski Alpin & Wintersport', labelEn: 'Alpine Skiing & Winter Sports', icon: '⛷️' },
  { id: 'icehockey', cat: 'Sport', labelDe: 'Eishockey (National League)', labelEn: 'Ice Hockey', icon: '🏒' },

  // Tech, AI & Science Beats
  { id: 'ai', cat: 'Tech & Science', labelDe: 'KI & Halbleiter', labelEn: 'AI & Chips', icon: '🤖' },
  { id: 'space', cat: 'Tech & Science', labelDe: 'Raumfahrt & CERN', labelEn: 'Space & Astrophysics', icon: '🚀' },
  { id: 'cyber', cat: 'Tech & Science', labelDe: 'Cyber-Sicherheit & Hacking', labelEn: 'Cybersecurity & Privacy', icon: '🛡️' },
  { id: 'biotech', cat: 'Tech & Science', labelDe: 'Pharma & Biotechnologie', labelEn: 'Pharma & Biotech', icon: '🧬' },

  // Finance, Economy & Swiss Beats
  { id: 'snb', cat: 'Wirtschaft', labelDe: 'SNB & Zinspolitik', labelEn: 'SNB & Monetary Policy', icon: '🏦' },
  { id: 'crypto', cat: 'Wirtschaft', labelDe: 'Fintech & Krypto', labelEn: 'Fintech & Digital Assets', icon: '🪙' },
  { id: 'realestate', cat: 'Wirtschaft', labelDe: 'Immobilien & Wohnen', labelEn: 'Real Estate & Housing', icon: '🏢' },
  { id: 'energy', cat: 'Wirtschaft', labelDe: 'Energie & Kernkraft', labelEn: 'Energy & Power Grids', icon: '⚡' },
  { id: 'defense', cat: 'Politik', labelDe: 'Schweizer Armee & Geopolitik', labelEn: 'Swiss Defense & NATO', icon: '🎖️' },
  { id: 'watches', cat: 'Kultur', labelDe: 'Schweizer Uhren & Luxus', labelEn: 'Swiss Watches & Luxury', icon: '⌚' },
];

export const DEFAULT_ACTIVE_TOPICS = [
  'world', 'politics', 'business', 'tech', 'science', 'climate', 'health', 'culture', 'sport'
];
