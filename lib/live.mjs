// Pure helpers for live tickers. Safe to import from client components:
// no filesystem, no Supabase, no Node built-ins.
import { SOURCE_LOCALE } from './config.mjs';

export const LIVE_STATUSES = ['live', 'ended'];

/**
 * A live ticker is one continuing real-world event (an election night, a
 * war, a disaster) that gets a chronological stream of verified updates.
 *
 * Shape (see content/live/*.json):
 * {
 *   slug, status: 'live'|'ended', category, importance, topic, keywords[],
 *   startedAt, endedAt, updatedAt, articleSlug,
 *   locales: { en: { title, dek }, de: {…}, … },
 *   updates: [{
 *     id, at, kind: 'result'|'statement'|'reaction'|'context'|'breaking',
 *     importance, locales: { en: { headline, body }, … },
 *     sources: [{ outlet, title, url, publishedAt }]
 *   }],
 *   article: { slug, updatedAt, locales: { en: { title, dek, facts[], body[] }, de: {…} },
 *              versions: [{ at, reason, locales: { en: {…}, de: {…} } }] }
 * }
 */

export function liveLocalize(ticker, locale) {
  const l = ticker?.locales?.[locale] || ticker?.locales?.[SOURCE_LOCALE] || {};
  return {
    title: l.title || ticker?.topic || '',
    dek: l.dek || '',
    isFallback: !ticker?.locales?.[locale],
  };
}

export function updateLocalize(update, locale) {
  const l = update?.locales?.[locale] || update?.locales?.[SOURCE_LOCALE] || {};
  return {
    headline: l.headline || '',
    body: l.body || '',
    isFallback: !update?.locales?.[locale],
  };
}

export function liveIsActive(ticker) {
  return ticker?.status === 'live';
}

/** Updates, newest first. */
export function liveUpdates(ticker) {
  return [...(ticker?.updates || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

const statLabel = (node, locale, field = 'label') =>
  node?.locales?.[locale]?.[field] ?? node?.locales?.[SOURCE_LOCALE]?.[field] ?? node?.[field] ?? '';

/**
 * Normalized statistics block of a ticker or of its running article.
 *
 * Statistics are the one content type where PLAIN does not require two
 * independent outlets: one trustworthy source (statistical office, election
 * commission, central bank, wire service) is enough, because a number is either
 * published or it is not. The gate lives in bots/live.mjs; this helper only
 * prepares the numbers for rendering.
 *
 * Shape:
 * {
 *   asOf, unit, max, label, note,
 *   source: { outlet, title, url, publishedAt, trusted },
 *   rows: [{ key, label, value, unit, change, pct }]
 * }
 */
export function liveStats(ticker, locale = SOURCE_LOCALE) {
  const s = ticker?.stats || ticker?.article?.stats || null;
  if (!s || !Array.isArray(s.rows) || !s.rows.length) return null;

  const values = s.rows.map((r) => Math.abs(+r.value)).filter((n) => Number.isFinite(n));
  const max = Number.isFinite(+s.max) && +s.max > 0 ? +s.max : Math.max(100, ...values);

  return {
    asOf: s.asOf || s.updatedAt || null,
    unit: s.unit || '',
    max,
    label: statLabel(s, locale),
    note: statLabel(s, locale, 'note'),
    source: s.source || null,
    rows: s.rows.map((r) => {
      const value = +r.value;
      return {
        key: r.key || statLabel(r, SOURCE_LOCALE) || String(r.value),
        label: statLabel(r, locale),
        value: Number.isFinite(value) ? value : r.value,
        unit: r.unit || s.unit || '',
        change: Number.isFinite(+r.change) && r.change !== null && r.change !== undefined ? +r.change : null,
        pct: Number.isFinite(value) ? Math.max(0, Math.min(100, (Math.abs(value) / max) * 100)) : 0,
      };
    }),
  };
}

/** True when the event is the kind of story that produces numbers. */
export function wantsStats(ticker) {
  if (ticker?.stats) return true;
  if (ticker?.wantsStats) return true;
  const text = [ticker?.topic, ...(ticker?.keywords || [])].join(' ');
  return /election|wahl|vote|vot|referendum|count|auszähl|result|ergebnis|poll|umfrage|seat|sitz|mandate|census|inflation|rate|gdp|bip|unemploy|arbeitslos|statistic|death toll|casualt|tote|turnout|beteiligung/i.test(text);
}

export function liveLastAt(ticker) {
  const times = [ticker?.updatedAt, ...(ticker?.updates || []).map((u) => u.at)]
    .map((t) => Date.parse(t))
    .filter((n) => Number.isFinite(n));
  return times.length ? new Date(Math.max(...times)).toISOString() : ticker?.startedAt || null;
}

export function liveUpdateCount(ticker) {
  return (ticker?.updates || []).length;
}

/** Compact summary used by /api/live, the banner and the overview page. */
export function liveSummary(ticker, locale = SOURCE_LOCALE) {
  const l = liveLocalize(ticker, locale);
  const updates = liveUpdates(ticker);
  const latest = updates[0];
  return {
    slug: ticker.slug,
    status: ticker.status,
    category: ticker.category,
    importance: ticker.importance || 3,
    title: l.title,
    dek: l.dek,
    startedAt: ticker.startedAt,
    updatedAt: liveLastAt(ticker),
    endedAt: ticker.endedAt || null,
    updateCount: updates.length,
    articleSlug: ticker.articleSlug || ticker.article?.slug || null,
    latest: latest
      ? {
          at: latest.at,
          kind: latest.kind || 'context',
          headline: updateLocalize(latest, locale).headline,
        }
      : null,
  };
}

const KIND_LABELS = {
  breaking: { en: 'Breaking', de: 'Eilmeldung', fr: 'Urgent', es: 'Última hora', it: 'Ultim’ora', pt: 'Urgente', zh: '突发', ja: '速報', ko: '속보' },
  result: { en: 'Result', de: 'Ergebnis', fr: 'Résultat', es: 'Resultado', it: 'Risultato', pt: 'Resultado', zh: '结果', ja: '結果', ko: '결과' },
  statement: { en: 'Statement', de: 'Statement', fr: 'Déclaration', es: 'Declaración', it: 'Dichiarazione', pt: 'Declaração', zh: '声明', ja: '声明', ko: '성명' },
  reaction: { en: 'Reaction', de: 'Reaktion', fr: 'Réaction', es: 'Reacción', it: 'Reazione', pt: 'Reação', zh: '反应', ja: '反応', ko: '반응' },
  context: { en: 'Context', de: 'Hintergrund', fr: 'Contexte', es: 'Contexto', it: 'Contesto', pt: 'Contexto', zh: '背景', ja: '背景', ko: '배경' },
};

export function kindLabel(kind, locale = 'de') {
  return KIND_LABELS[kind]?.[locale] || KIND_LABELS[kind]?.en || KIND_LABELS.context[locale] || 'Update';
}

/** "14:32" in the reader's locale, always 24h for tickers. */
export function clock(iso, locale = 'de') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale === 'en' ? 'en-GB' : locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  });
}

export function dayLabel(iso, locale = 'de') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale === 'en' ? 'en-GB' : locale, {
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/Zurich',
  });
}

/** True when the ticker has been updated within `minutes`. */
export function isFresh(ticker, minutes = 45) {
  const last = liveLastAt(ticker);
  if (!last) return false;
  return Date.now() - Date.parse(last) < minutes * 60e3;
}
