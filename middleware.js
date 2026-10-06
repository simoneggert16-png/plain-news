import { NextResponse } from 'next/server';
import { LOCALE_CODES, DEFAULT_LOCALE } from './lib/config.mjs';

// Redirect "/" and un-prefixed paths to the visitor's language.
export function middleware(req) {
  const { pathname } = req.nextUrl;
  const first = pathname.split('/')[1];
  if (LOCALE_CODES.includes(first)) return;

  const saved = req.cookies.get('lang')?.value;
  const accept = (req.headers.get('accept-language') || '')
    .split(',')
    .map((p) => p.split(';')[0].trim().slice(0, 2).toLowerCase());
  const locale = [saved, ...accept].find((l) => LOCALE_CODES.includes(l)) || DEFAULT_LOCALE;

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next|favicon|icon|robots|sitemap|.*\\..*).*)'],
};
