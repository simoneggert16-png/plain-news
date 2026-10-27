'use client';

import { useEffect, useState } from 'react';
import { getDict } from '@/lib/i18n.mjs';
import { LIVE_BANNER_KEY } from './LiveBanner';

/** Turns the global live banner back on after a visitor dismissed it. */
export default function LiveBannerToggle({ locale = 'de' }) {
  const [off, setOff] = useState(false);
  const t = getDict(locale).live;

  useEffect(() => {
    try { setOff(localStorage.getItem(LIVE_BANNER_KEY) === '1'); } catch {}
  }, []);

  const toggle = () => {
    try {
      if (off) localStorage.removeItem(LIVE_BANNER_KEY);
      else localStorage.setItem(LIVE_BANNER_KEY, '1');
    } catch {}
    setOff(!off);
    if (off) window.dispatchEvent(new Event('plain-live-banner-on'));
  };

  return (
    <button type="button" className={`live-banner-toggle ${off ? 'is-off' : ''}`} onClick={toggle}>
      <span className="live-banner-toggle-dot" aria-hidden="true" />
      {off ? t.bannerOn : t.bannerOff}
    </button>
  );
}
