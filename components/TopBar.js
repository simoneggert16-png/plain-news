'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LOCALES } from '@/lib/config.mjs';
import { fmtNum, fmtPct } from '@/lib/format.mjs';

export default function TopBar({ locale }) {
  const [now, setNow] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const path = usePathname();
  const router = useRouter();
  const bcp = LOCALES.find((l) => l.code === locale)?.bcp47;

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 30_000);
    const load = () =>
      fetch('/api/markets?strip=1')
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setQuotes(d.filter((q) => !q.error)))
        .catch(() => {});
    load();
    const poll = setInterval(load, 60_000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, []);

  function switchLang(e) {
    const next = e.target.value;
    document.cookie = `lang=${next};path=/;max-age=31536000;samesite=lax`;
    router.push(path.replace(/^\/[a-z]{2}/, `/${next}`));
  }

  const items = quotes.length ? [...quotes, ...quotes] : [];

  return (
    <div className="topbar">
      <div className="topbar-date">
        {now && now.toLocaleDateString(bcp, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
      <div className="ticker" aria-label="Market ticker">
        <div className="ticker-track" style={{ animationDuration: `${Math.max(30, quotes.length * 6)}s` }}>
          {items.map((q, i) => (
            <span key={i} className="ticker-item">
              <b>{q.label}</b> {fmtNum(q.price, bcp)}{' '}
              <span className={q.change >= 0 ? 'up' : 'down'}>{fmtPct(q.changePct, bcp)}</span>
            </span>
          ))}
        </div>
      </div>
      <label className="lang">
        <span className="sr-only">Language</span>
        <select value={locale} onChange={switchLang}>
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>{l.short}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
