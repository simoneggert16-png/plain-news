#!/usr/bin/env node
// Fill translations that are missing in the published archive.
//
// The newsroom saves an article before translating it; if that translate call
// fails (rate limit, malformed JSON) the article stays source-language only and
// the German site silently falls back to English. This script redoes those
// translations in bulk, with retries, and can be run any time.
//
//   node scripts/translate-missing.mjs            # everything that is missing
//   LIMIT=10 CONCURRENCY=3 node scripts/translate-missing.mjs
import { loadIndex, saveIndex, loadArticle, saveArticle, toIndexEntry } from '../bots/lib/store.mjs';
import { translate } from '../bots/lib/translate.mjs';
import { LOCALES, SOURCE_LOCALE } from '../lib/config.mjs';

const TARGETS = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);
const LIMIT = Number(process.env.LIMIT) > 0 ? Number(process.env.LIMIT) : Infinity;
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY) || 4);
const RETRIES = Math.max(1, Number(process.env.RETRIES) || 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const index = loadIndex();
const missing = index.articles.filter((e) => TARGETS.some((c) => !e.locales?.[c]?.title));
console.log(`archive: ${index.articles.length} articles, ${missing.length} missing a translation`);
if (!missing.length) process.exit(0);

const jobs = [];
for (const entry of missing.slice(0, LIMIT)) {
  for (const locale of TARGETS) {
    if (!entry.locales?.[locale]?.title) jobs.push({ entry, locale });
  }
}
console.log(`jobs: ${jobs.length} (concurrency ${CONCURRENCY}, retries ${RETRIES})`);

let cursor = 0;
let fixed = 0;
const failures = [];

async function worker() {
  while (cursor < jobs.length) {
    const { entry, locale } = jobs[cursor++];
    const article = loadArticle(entry.slug);
    if (!article) { failures.push(`${entry.slug}/${locale}: article file missing`); continue; }
    const source = article.locales?.[SOURCE_LOCALE];
    if (!source?.title) { failures.push(`${entry.slug}/${locale}: no source text`); continue; }
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        const t = await translate(source, locale);
        article.locales[locale] = t;
        article.updatedAt = new Date().toISOString();
        saveArticle(article);
        const i = index.articles.findIndex((x) => x.slug === entry.slug);
        if (i >= 0) index.articles[i] = toIndexEntry(article);
        fixed++;
        console.log(`  ok    ${entry.slug} -> ${locale}`);
        break;
      } catch (err) {
        const msg = err?.message || String(err);
        if (attempt === RETRIES) failures.push(`${entry.slug}/${locale}: ${msg}`);
        else {
          console.log(`  retry ${entry.slug}/${locale} (${attempt}/${RETRIES}): ${msg}`);
          await sleep(1500 * attempt);
        }
      }
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
if (fixed) saveIndex(index);

console.log(`done: ${fixed} translation(s) written, ${failures.length} still failing`);
for (const f of failures.slice(0, 20)) console.log(`  fail ${f}`);
process.exitCode = failures.length ? 1 : 0;
