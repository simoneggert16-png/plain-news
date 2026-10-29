import Link from 'next/link';
import { CATEGORIES, SITE } from '@/lib/config.mjs';
import TopBar from './TopBar';
import NavLinks from './NavLinks';

export default function Header({ locale, t }) {
  const items = [
    { href: `/${locale}`, label: t.latest },
    { href: `/${locale}/ticker`, label: locale === 'de' ? 'Ticker' : 'Wire' },
    ...CATEGORIES.map((c) => ({ href: `/${locale}/c/${c}`, label: t.cat[c] })),
    { href: `/${locale}/longreads`, label: t.longreads.nav },
    { href: `/${locale}/investigations`, label: t.investigations.nav },
    { href: `/${locale}/markets`, label: t.markets },
    { href: `/${locale}/live`, label: t.live.nav },
  ];
  return (
    <header className="site-header">
      <TopBar locale={locale} />
      <div className="wrap masthead">
        <Link href={`/${locale}`} className="logo" aria-label={SITE.name}>
          PLAIN<span className="logo-dot">.</span>
        </Link>
        <p className="tagline">{t.tagline}</p>
      </div>
      <nav className="wrap nav" aria-label="Sections">
        <NavLinks items={items} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link href={`/${locale}/saved`} className="nav-about">
            {locale === 'de' ? ' Gemerkt' : ' Saved'}
          </Link>
          <Link href={`/${locale}/about`} className="nav-about">{t.about}</Link>
        </div>
      </nav>
    </header>
  );
}
