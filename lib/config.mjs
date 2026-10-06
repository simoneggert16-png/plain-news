// Shared config for the website AND the bots. Keep this file dependency-free.

export const SITE = {
  name: 'PLAIN.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://plain-news.vercel.app',
};

// Order = order in the language switcher. First entry is the source language of the bots.
export const LOCALES = [
  { code: 'en', label: 'English', short: 'EN', bcp47: 'en-GB' },
  { code: 'de', label: 'Deutsch', short: 'DE', bcp47: 'de-DE' },
  { code: 'fr', label: 'Français', short: 'FR', bcp47: 'fr-FR' },
  { code: 'es', label: 'Español', short: 'ES', bcp47: 'es-ES' },
  { code: 'it', label: 'Italiano', short: 'IT', bcp47: 'it-IT' },
  { code: 'pt', label: 'Português', short: 'PT', bcp47: 'pt-PT' },
  { code: 'zh', label: '中文', short: '中文', bcp47: 'zh-CN' },
  { code: 'ja', label: '日本語', short: '日本語', bcp47: 'ja-JP' },
  { code: 'ko', label: '한국어', short: '한국어', bcp47: 'ko-KR' },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);
export const DEFAULT_LOCALE = 'en';
export const SOURCE_LOCALE = 'en';

export const CATEGORIES = [
  'world',
  'politics',
  'business',
  'tech',
  'science',
  'climate',
  'health',
  'culture',
  'sport',
];

export const isLocale = (l) => LOCALE_CODES.includes(l);
export const isCategory = (c) => CATEGORIES.includes(c);
