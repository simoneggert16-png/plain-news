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

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!e.target.closest('.lang-dropdown')) setOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  function switchLang(next) {
    document.cookie = `lang=${next};path=/;max-age=31536000;samesite=lax`;
    setOpen(false);
    router.push(path.replace(/^\/[a-z]{2}/, `/${next}`));
  }

  const items = quotes.length ? [...quotes, ...quotes] : [];
  const currentLocale = LOCALES.find((l) => l.code === locale) || LOCALES[0];

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
      <div className="lang-dropdown">
        <button
          type="button"
          className="lang-btn"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span>{currentLocale.short}</span>
          <span className="lang-arrow" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
        {open && (
          <ul className="lang-menu" role="listbox">
            {LOCALES.map((l) => (
              <li
                key={l.code}
                role="option"
                aria-selected={l.code === locale}
                className={`lang-option ${l.code === locale ? 'active' : ''}`}
                onClick={() => switchLang(l.code)}
              >
                <span className="lang-code">{l.short}</span>
                <span className="lang-label">{l.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
