#!/usr/bin/env node
// Find locales whose "translation" is byte-for-byte the English text and drop
// them.
//
// Why: the live-ticker pipeline used to fall back to the source string when a
// translation call dropped a field. The article then carried an English text
// in the de slot, and every later backfill skipped it ("de already exists").
// That is how the most important stories (Iran, Fed, Israel election) sat on
// the German front page in English.
//
// Dropping the fake locale is safe: the page falls back to English for one
// cycle, the translation backfill refills it properly.
//
//   node scripts/repair-translations.mjs           # report + fix
//   node scripts/repair-translations.mjs --dry     # report only
import { loadIndex, saveIndex, loadArticle, saveArticle } from '../bots/lib/store.mjs';
import { LOCALES, SOURCE_LOCALE } from '../lib/config.mjs';

const DRY = process.argv.includes('--dry');
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const TARGETS = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);

function fakeLocales(locales = {}) {
  const en = norm(locales[SOURCE_LOCALE]?.title);
  if (!en) return [];
  return TARGETS.filter((c) => {
    const t = locales[c]?.title;
    return t && norm(t) === en;
  });
}

const index = loadIndex();
let articles = 0;
let removed = 0;
const touched = new Set();

for (const entry of index.articles || []) {
  const fake = fakeLocales(entry.locales);
  if (!fake.length) continue;
  articles += 1;
  removed += fake.length;
  console.log(`${entry.slug}: dropping ${fake.join(', ')} (English text in ${fake.join('/')})`);
  if (DRY) continue;

  for (const c of fake) delete entry.locales[c];
  touched.add(entry.slug);

  const doc = loadArticle(entry.slug);
  if (doc?.locales) {
    for (const c of fake) delete doc.locales[c];
    saveArticle(doc);
  }
}

if (!DRY && touched.size) saveIndex(index);
console.log(`${DRY ? 'Would repair' : 'Repaired'} ${articles} article(s), ${removed} fake translation(s).`);
