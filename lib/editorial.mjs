// Shared editorial policy for the newsroom, maintenance and the site.
// Keep this file dependency-free (it is imported by both Node bots and Next.js).
import { CATEGORIES } from './config.mjs';

// Official primary sources: governments, courts, international organisations,
// statistical agencies and peer-reviewed journals. News outlets and wires
// (BBC, Reuters, AP, CNBC, newspapers, …) are authoritative but NOT primary:
// a single report from one of them is still a single source.
const PRIMARY_PATTERNS = [
  /\b(WHO|World Health Organization|CDC|NASA|ESA|CERN|UN News|United Nations|UNICEF|UNHCR|IMF|World Bank|OECD|IPCC|Copernicus|NOAA|Eurostat)\b/i,
  /\b(Nature|Science|ScienceDaily|Phys\.org|The Lancet|NEJM|JAMA|BMJ|Cell|PNAS)\b/i,
  /\b(Government|Ministry|Department of|Court|Tribunal|Parliament|Congress|Senate)\b/i,
  /(^|\.)gov(\.[a-z]{2})?$/i,
  /(^|\.)int$/i,
  /\b(press release|official statement|company statement)\b/i,
];

const normOutlet = (s) => String(s || '').trim();

/** Distinct outlet names, case-insensitive, preserving first spelling. */
export function distinctOutlets(sources = []) {
  const byKey = new Map();
  for (const s of sources || []) {
    const name = normOutlet(typeof s === 'string' ? s : s?.outlet);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, name);
  }
  return [...byKey.values()];
}

export function isPrimaryOutlet(outlet = '') {
  const s = normOutlet(outlet);
  if (!s) return false;
  return PRIMARY_PATTERNS.some((re) => re.test(s));
}

// Constructive-journalism outlets do original reporting that no second outlet
// picks up. They are accepted as a single source so genuine good-news stories
// are not filtered out by the two-source rule.
const CONSTRUCTIVE_PATTERNS = /^(Good News Network|Positive News|Reasons to Be Cheerful|The Optimist Daily)$/i;

export function isConstructiveOutlet(outlet = '') {
  return CONSTRUCTIVE_PATTERNS.test(normOutlet(outlet));
}

/**
 * Classify a source list.
 * - two-source: at least two different outlets
 * - primary:    exactly one outlet, but it is an official primary source
 * - constructive: exactly one outlet from the constructive-journalism list
 * - insufficient: everything else (single news outlet, no outlets, …)
 */
export function classifySources(sources = []) {
  const outlets = distinctOutlets(sources);
  if (outlets.length >= 2) return { ok: true, policy: 'two-source', outlets };
  if (outlets.length === 1 && isPrimaryOutlet(outlets[0])) return { ok: true, policy: 'primary', outlets };
  if (outlets.length === 1 && (isConstructiveOutlet(outlets[0]) || sources.some((s) => s?.positive))) {
    return { ok: true, policy: 'constructive', outlets };
  }
  return { ok: false, policy: 'insufficient', outlets };
}

/** Coerce common LLM shape mistakes into the article schema. */
export function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return draft;
  const out = { ...draft };

  const toStringArray = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string') {
      const parts = v.split(/\n{2,}|\n/).map((x) => x.trim()).filter(Boolean);
      if (parts.length >= 2) return parts;
      const sentences = v.match(/[^.!?]+[.!?]+/g) || [v];
      if (sentences.length >= 2) {
        const groups = [];
        for (let i = 0; i < sentences.length; i += 2) groups.push(sentences.slice(i, i + 2).join(' ').trim());
        return groups.filter(Boolean);
      }
      return parts;
    }
    if (v && typeof v === 'object') return Object.values(v).map((x) => String(x).trim()).filter(Boolean);
    return v;
  };

  out.body = toStringArray(out.body);
  const toFactsArray = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/[;\n]+/).map((x) => x.trim()).filter(Boolean);
    if (v && typeof v === 'object') return Object.values(v).map((x) => String(x).trim()).filter(Boolean);
    return v;
  };
  out.facts = toFactsArray(out.facts);
  if (typeof out.title === 'string') out.title = out.title.trim();
  if (typeof out.dek === 'string') out.dek = out.dek.trim();
  if (typeof out.context === 'string') out.context = out.context.trim();
  return out;
}

/** Structural checks only — used by maintenance so valid legacy articles are never deleted for source policy. */
export function isStructurallyValid(a, { minBody = 1, minFacts = 1 } = {}) {
  if (!a || typeof a !== 'object') return { ok: false, reason: 'missing-article' };
  if (!a.slug || typeof a.slug !== 'string') return { ok: false, reason: 'missing-slug' };
  if (!CATEGORIES.includes(a.category)) return { ok: false, reason: 'invalid-category' };
  if (!a.publishedAt || Number.isNaN(Date.parse(a.publishedAt))) return { ok: false, reason: 'invalid-date' };
  if (!Array.isArray(a.sources) || a.sources.length < 1) return { ok: false, reason: 'missing-sources' };

  const en = a.locales?.en;
  if (!en || typeof en.title !== 'string' || en.title.trim().length < 10) return { ok: false, reason: 'missing-title' };
  if (typeof en.dek !== 'string' || !en.dek.trim()) return { ok: false, reason: 'missing-dek' };
  if (!Array.isArray(en.body) || en.body.filter(Boolean).length < minBody) return { ok: false, reason: 'missing-body' };
  if (!Array.isArray(en.facts) || en.facts.filter(Boolean).length < minFacts) return { ok: false, reason: 'missing-facts' };
  return { ok: true, reason: 'ok' };
}

/** Full publication gate: structure + source policy. */
export function isPublishableArticle(a, opts = {}) {
  const structural = isStructurallyValid(a, opts);
  if (!structural.ok) return { ...structural, ...classifySources(a?.sources || []) };
  const sources = classifySources(a.sources);
  if (!sources.ok) return { ok: false, reason: 'insufficient-sources', ...sources };
  return { ok: true, reason: 'ok', ...sources };
}

/** Human label key for the site: 'two-source' | 'primary' | 'insufficient'. */
export function sourcePolicyOf(a) {
  return a?.sourcePolicy || classifySources(a?.sources || []).policy;
}
