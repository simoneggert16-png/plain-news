import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT = path.join(ROOT, 'content');
export const ARTICLES = path.join(CONTENT, 'articles');
const INDEX = path.join(CONTENT, 'index.json');
const STATE = path.join(CONTENT, 'state.json');

fs.mkdirSync(ARTICLES, { recursive: true });

const read = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');

export const loadIndex = () => read(INDEX, { articles: [] });
export const saveIndex = (idx) => write(INDEX, { updatedAt: new Date().toISOString(), articles: idx.articles });
export const loadState = () => read(STATE, { seenUrls: [], runs: [] });
export const saveState = (s) => write(STATE, s);
export const loadArticle = (slug) => read(path.join(ARTICLES, `${slug}.json`), null);
export const saveArticle = (a) => write(path.join(ARTICLES, `${a.slug}.json`), a);
export const deleteArticle = (slug) => fs.rmSync(path.join(ARTICLES, `${slug}.json`), { force: true });
export const listArticleFiles = () => fs.readdirSync(ARTICLES).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));

export function toIndexEntry(a) {
  return {
    slug: a.slug,
    category: a.category,
    image: a.image || null,
    imageCredit: a.imageCredit || null,
    video: a.video || null,
    importance: a.importance,
    publishedAt: a.publishedAt,
    updatedAt: a.updatedAt,
    sourceCount: new Set(a.sources.map((s) => s.outlet)).size,
    locales: Object.fromEntries(Object.entries(a.locales).map(([l, v]) => [
      l,
      {
        title: v.title,
        dek: v.dek,
        facts: (v.facts || []).slice(0, 3),
        imageCaption: v.imageCaption || null,
      },
    ])),
  };
}

export function slugify(title, date = new Date()) {
  const base = title
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .split('-').slice(0, 9).join('-');
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `${base || 'story'}-${d}-${Math.random().toString(36).slice(2, 6)}`;
}
