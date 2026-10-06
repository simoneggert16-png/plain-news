import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_LOCALE } from './config.mjs';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const ARTICLES_DIR = path.join(CONTENT_DIR, 'articles');
const INDEX_FILE = path.join(CONTENT_DIR, 'index.json');

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Lightweight list of all published stories (newest first). */
export function getIndex() {
  const idx = readJSON(INDEX_FILE, { articles: [] });
  return [...(idx.articles || [])].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export function getArticle(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return readJSON(path.join(ARTICLES_DIR, `${slug}.json`), null);
}

/** Pick localized fields with fallback to the source language. */
export function localize(entry, locale) {
  const l = entry.locales?.[locale] || entry.locales?.[SOURCE_LOCALE] || {};
  return { ...l, isFallback: !entry.locales?.[locale] };
}

export function listFor({ category, limit } = {}) {
  let list = getIndex();
  if (category) list = list.filter((a) => a.category === category);
  return limit ? list.slice(0, limit) : list;
}

export function readingMinutes(article, locale) {
  const l = localize(article, locale);
  const text = [l.dek, ...(l.facts || []), ...(l.body || []), l.context].join(' ');
  // CJK has no spaces – approximate by characters.
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
  const units = cjk ? text.length / 400 : text.split(/\s+/).length / 220;
  return Math.max(1, Math.round(units));
}
