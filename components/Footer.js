import Link from 'next/link';
import { SITE } from '@/lib/config.mjs';

export default function Footer({ locale, t }) {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div className="footer-logo">PLAIN<span className="logo-dot">.</span></div>
        <p className="footer-claim">{t.footer}</p>
        <nav className="footer-links">
          <Link href={`/${locale}/about`}>{t.about}</Link>
          <Link href={`/${locale}/markets`}>{t.markets}</Link>
          <a href="/feed.xml">RSS</a>
        </nav>
        <p className="footer-small">© {new Date().getFullYear()} {SITE.name} · Open source · AI-assisted, human-principled.</p>
      </div>
    </footer>
  );
}
