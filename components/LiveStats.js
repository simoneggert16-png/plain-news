'use client';

import { clock, liveStats } from '@/lib/live.mjs';
import { getDict } from '@/lib/i18n.mjs';

function fmtNumber(value, locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 1;
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return n.toFixed(digits).replace(/\.0$/, '');
  }
}

/**
 * Live statistics block: election results, counts, turnout, rates.
 *
 * Unlike every other block on the site this one needs only ONE source. A
 * number is either published or it is not, so the bot only accepts snapshots
 * from a trusted source (statistical office, election commission, central bank,
 * wire service) and links exactly that source.
 */
export default function LiveStats({ stats, locale = 'de', compact = false }) {
  const s = liveStats({ stats }, locale);
  if (!s) return null;
  const t = getDict(locale).live;

  return (
    <section className={`live-stats ${compact ? 'is-compact' : ''}`}>
      <header className="live-stats-head">
        <h2 className="live-stats-label">{s.label || t.stats}</h2>
        <div className="live-stats-meta">
          {s.asOf && (
            <span className="live-stats-asof">
              {t.asOf} <time dateTime={s.asOf}>{clock(s.asOf, locale)}</time>
            </span>
          )}
          {s.source?.trusted && <span className="live-stats-trusted">{t.trusted}</span>}
        </div>
      </header>

      <ul className="live-stats-rows">
        {s.rows.map((r) => (
          <li key={r.key} className="live-stats-row">
            <span className="live-stats-name">{r.label}</span>
            <span className="live-stats-track" aria-hidden="true">
              <span className="live-stats-fill" style={{ width: `${r.pct}%` }} />
            </span>
            <span className="live-stats-value">
              {fmtNumber(r.value, locale)}
              {r.unit && <span className="live-stats-unit">{r.unit}</span>}
            </span>
            {r.change !== null && r.change !== 0 && (
              <span className={`live-stats-change ${r.change > 0 ? 'is-up' : 'is-down'}`}>
                {r.change > 0 ? '+' : '−'}
                {fmtNumber(Math.abs(r.change), locale)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {s.note && <p className="live-stats-note">{s.note}</p>}

      {s.source && (
        <footer className="live-stats-source">
          <span>{t.statSource}</span>
          <a href={s.source.url} target="_blank" rel="noopener noreferrer nofollow">
            {s.source.outlet}
          </a>
          {s.source.title && <span className="live-stats-source-title">{s.source.title}</span>}
        </footer>
      )}
    </section>
  );
}
