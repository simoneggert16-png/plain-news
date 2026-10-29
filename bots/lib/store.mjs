import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifySources, distinctOutlets } from '../../lib/editorial.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT = path.join(ROOT, 'content');
export const ARTICLES = path.join(CONTENT, 'articles');
const INDEX = path.join(CONTENT, 'index.json');
const STATE = path.join(CONTENT, 'state.json');

fs.mkdirSync(ARTICLES, { recursive: true });

const read = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');

/**
 * Never treat an unreadable index as an empty archive.
 *
 * The old fallback returned {articles: []} on any parse error. Every writer
 * then saved a "repaired" index with just the few entries it had touched - one
 * bad read wiped 930 of 936 articles from the front page. Failing loudly is
 * the only safe behaviour for the archive.
 */
export const loadIndex = () => {
  if (!fs.existsSync(INDEX)) return { articles: [] };
  const raw = fs.readFileSync(INDEX, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`content/index.json is unreadable (${e.message}) - refusing to continue with an empty archive`);
  }
  if (!Array.isArray(parsed.articles)) {
    throw new Error('content/index.json has no articles array - refusing to continue with an empty archive');
  }
  return parsed;
};

/** Refuse to shrink the archive by more than half in one write. */
export const saveIndex = (idx) => {
  const articles = Array.isArray(idx?.articles) ? idx.articles : [];
  let prev = 0;
  try {
    const raw = fs.readFileSync(INDEX, 'utf8');
    const parsed = JSON.parse(raw);
    prev = Array.isArray(parsed.articles) ? parsed.articles.length : 0;
  } catch { prev = 0; }
  if (prev >= 20 && articles.length < prev * 0.5) {
    throw new Error(`refusing to shrink content/index.json from ${prev} to ${articles.length} entries`);
  }
  write(INDEX, { updatedAt: new Date().toISOString(), articles });
};
export const loadState = () => read(STATE, { seenUrls: [], runs: [] });
export const saveState = (s) => write(STATE, s);
export const loadArticle = (slug) => read(path.join(ARTICLES, `${slug}.json`), null);
export const saveArticle = (a) => write(path.join(ARTICLES, `${a.slug}.json`), a);
export const deleteArticle = (slug) => fs.rmSync(path.join(ARTICLES, `${slug}.json`), { force: true });
export const listArticleFiles = () => fs.readdirSync(ARTICLES).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));

const WORDS = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

/** Reading time in minutes for a localized block (CJK counted by characters). */
function minutesFor(v) {
  const text = [v?.standfirst, v?.dek, ...(v?.facts || []), ...(v?.body || []), v?.context].join(' ');
  if (!text.trim()) return 1;
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
  return Math.max(1, Math.round(cjk ? text.length / 400 : WORDS(text) / 220));
}

export function toIndexEntry(a) {
  const form = a.form || 'report';
  const entry = {
    slug: a.slug,
    category: a.category,
    form,
    image: a.image || null,
    imageCredit: a.imageCredit || null,
    video: a.video || null,
    importance: a.importance,
    publishedAt: a.publishedAt,
    updatedAt: a.updatedAt,
    sourceCount: distinctOutlets(a.sources || []).length,
    sourcePolicy: a.sourcePolicy || classifySources(a.sources || {}).policy,
    locales: Object.fromEntries(Object.entries(a.locales).map(([l, v]) => [
      l,
      {
        title: v.title,
        dek: v.dek,
        standfirst: v.standfirst || null,
        facts: (v.facts || []).slice(0, 3),
        imageCaption: v.imageCaption || null,
      },
    ])),
  };
  // Only long reads carry a length marker; normal reports stay slim.
  if (form === 'longform') {
    entry.readingMinutes = a.readingMinutes || minutesFor(a.locales?.[SOURCE_LOCALE]);
  }
  return entry;
}

export function slugify(title, date = new Date()) {
  const base = title
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .split('-').slice(0, 9).join('-');
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `${base || 'story'}-${d}-${Math.random().toString(36).slice(2, 6)}`;
}
