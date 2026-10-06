'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LOCALES } from '@/lib/config.mjs';
import { fmtNum, fmtPct } from '@/lib/format.mjs';
import Sparkline from './Sparkline';

const GROUPS = ['indices', 'stocks', 'fx', 'commodities', 'crypto'];
const RANGES = ['1d', '5d', '1mo', '6mo', '1y', '5y'];

export default function MarketsBoard({ locale, t }) {
  const bcp = LOCALES.find((l) => l.code === locale)?.bcp47;
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [groups, setGroups] = useState(null);
  const [symbol, setSymbol] = useState(sp.get('s') || '^GSPC');
  const [range, setRange] = useState('1d');
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = () => fetch('/api/markets').then((r) => r.json()).then(setGroups).catch(() => setGroups({}));
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    setDetail((d) => (d && d.symbol === symbol ? { ...d, loading: true } : { symbol, loading: true }));
    fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => r.json())
      .then((d) => alive && setDetail(d.error ? { symbol, error: true } : d))
      .catch(() => alive && setDetail({ symbol, error: true }));
    return () => { alive = false; };
  }, [symbol, range]);

  const pick = useCallback((s) => {
    setSymbol(s);
    router.replace(`${path}?s=${encodeURIComponent(s)}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [path, router]);

  function onSearch(e) {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (q) pick(q);
  }

  return (
    <>
      <form className="mkt-search" onSubmit={onSearch}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.lookup} aria-label={t.lookup} autoCapitalize="characters" spellCheck="false" />
        <button className="btn" type="submit">{t.lookupBtn}</button>
      </form>

      <section className="detail">
        {detail?.error ? (
          <p>{symbol} — {t.notFound}</p>
        ) : !detail?.price ? (
          <p className="meta">{t.loading}</p>
        ) : (
          <>
            <div className="detail-head">
              <div>
                <span className="label">{detail.symbol} · {detail.exchange} · {detail.currency}</span>
                <h2 className="detail-name">{detail.name}</h2>
              </div>
              <div>
                <div className="detail-price">{fmtNum(detail.price, bcp)}</div>
                <div className={`mkt-chg ${detail.change >= 0 ? 'up' : 'down'}`} style={{ textAlign: 'right' }}>
                  {detail.change >= 0 ? '+' : '−'}{fmtNum(Math.abs(detail.change), bcp)} ({fmtPct(detail.changePct, bcp)}) · {range}
                </div>
              </div>
            </div>
            <div className="ranges">
              {RANGES.map((r) => (
                <button key={r} className={`btn btn-ghost ${r === range ? 'active' : ''}`} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
            <Sparkline data={detail.points?.map((p) => p[1])} className="chart" width={800} height={260} />
          </>
        )}
      </section>

      <div className="mkt-groups">
        {GROUPS.map((g) => (
          <section key={g}>
            <div className="sec-head" style={{ marginTop: 24 }}><h2>{t[g]}</h2></div>
            <table className="mkt-table">
              <thead>
                <tr><th>{t.name}</th><th className="sp"></th><th>{t.price}</th><th>{t.change}</th></tr>
              </thead>
              <tbody>
                {(groups?.[g] || []).map((q) => (
                  <tr key={q.symbol} onClick={() => pick(q.symbol)}>
                    <td>{q.label}<small>{q.symbol}</small></td>
                    <td className="sp"><Sparkline data={q.spark} width={80} height={22} /></td>
                    <td>{q.error ? '—' : fmtNum(q.price, bcp)}</td>
                    <td className={q.change >= 0 ? 'up' : 'down'}>{q.error ? '' : fmtPct(q.changePct, bcp)}</td>
                  </tr>
                ))}
                {!groups && <tr><td colSpan={4} className="meta">{t.loading}</td></tr>}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}
