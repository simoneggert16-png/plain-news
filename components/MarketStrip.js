'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LOCALES } from '@/lib/config.mjs';
import { fmtNum, fmtPct } from '@/lib/format.mjs';
import Sparkline from './Sparkline';

const PICK = ['^GSPC', '^IXIC', '^GDAXI', '^N225', 'EURUSD=X', 'BTC-USD'];

export default function MarketStrip({ locale }) {
  const [data, setData] = useState(null);
  const bcp = LOCALES.find((l) => l.code === locale)?.bcp47;

  useEffect(() => {
    const load = () =>
      fetch('/api/markets')
        .then((r) => r.json())
        .then((g) => {
          const flat = Object.values(g).flat();
          setData(PICK.map((s) => flat.find((q) => q.symbol === s)).filter(Boolean));
        })
        .catch(() => setData([]));
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const cells = data || PICK.map((s) => ({ symbol: s, loading: true }));
  return (
    <div className="mkt-strip">
      {cells.map((q) => (
        <Link key={q.symbol} href={`/${locale}/markets?s=${encodeURIComponent(q.symbol)}`} className="mkt-cell">
          <span className="label">{q.label || q.symbol}</span>
          <span className="mkt-price">{q.loading ? '···' : fmtNum(q.price, bcp)}</span>
          <span className={`mkt-chg ${q.change >= 0 ? 'up' : 'down'}`}>{q.loading ? '' : fmtPct(q.changePct, bcp)}</span>
          <Sparkline data={q.spark} />
        </Link>
      ))}
    </div>
  );
}
