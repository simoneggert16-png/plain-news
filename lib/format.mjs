export function fmtNum(v, locale, digits) {
  if (v == null || Number.isNaN(v)) return '—';
  const d = digits ?? (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : 4);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d }).format(v);
}

export function fmtPct(v, locale) {
  if (v == null || Number.isNaN(v)) return '—';
  const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
  return `${v >= 0 ? '+' : '−'}${s}%`;
}

export function fmtDate(iso, locale, opts = {}) {
  return new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short', ...opts });
}

/** Label for the source count. A single official primary source is labelled
 *  honestly instead of pretending there are two. */
export function sourceLabel(a, t) {
  if (a?.sourcePolicy === 'primary') return t?.primarySource || 'Primary source';
  const n = a?.sourceCount ?? (Array.isArray(a?.sources) ? new Set(a.sources.map((s) => s.outlet)).size : 0);
  return `${n} ${t?.sources ?? ''}`.trim();
}
