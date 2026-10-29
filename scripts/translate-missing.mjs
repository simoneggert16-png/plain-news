#!/usr/bin/env node
import fs from 'node:fs';
// Fill translations that are missing in the published archive.
//
// The newsroom saves an article before translating it; if that translate call
// fails (rate limit, malformed JSON) the article stays source-language only and
// the German site silently falls back to English. This script redoes those
// translations in bulk, with retries, and can be run any time.
//
//   node scripts/translate-missing.mjs            # everything that is missing
//   LIMIT=10 CONCURRENCY=3 node scripts/translate-missing.mjs
import { loadIndex, loadArticle, saveArticle } from '../bots/lib/store.mjs';
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

// German first, across all articles: /de is the edition readers see. If the
// run hits its timeout, the German editions are finished rather than half of
// nine languages.
const orderedTargets = ['de', ...TARGETS.filter((c) => c !== 'de')];
const jobs = [];
for (const locale of orderedTargets) {
  for (const entry of missing.slice(0, LIMIT)) {
    if (!entry.locales?.[locale]?.title) jobs.push({ entry, locale });
  }
}
console.log(`jobs: ${jobs.length} (concurrency ${CONCURRENCY}, retries ${RETRIES})`);

let cursor = 0;
let fixed = 0;
const fixedSlugs = new Set();
const failures = [];

// All locales of one article live in the same JSON file: translating them in
// parallel workers made each worker save its own stale copy, so only the last
// translation survived. One job per article, locales in sequence.
const bySlug = new Map();
for (const { entry, locale } of jobs) {
  if (!bySlug.has(entry.slug)) bySlug.set(entry.slug, { entry, locales: [] });
  bySlug.get(entry.slug).locales.push(locale);
}
const articleJobs = [...bySlug.values()];

async function worker() {
  while (cursor < articleJobs.length) {
    const { entry, locales } = articleJobs[cursor++];
    const article = loadArticle(entry.slug);
    if (!article) { failures.push(`${entry.slug}: article file missing`); continue; }
    const source = article.locales?.[SOURCE_LOCALE];
    if (!source?.title) { failures.push(`${entry.slug}: no source text`); continue; }
    let changed = false;
    for (const locale of locales) {
      for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
          const t = await translate(source, locale);
          article.locales[locale] = t;
          changed = true;
          fixedSlugs.add(entry.slug);
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
    if (changed) {
      article.updatedAt = new Date().toISOString();
      saveArticle(article);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, articleJobs.length) }, worker));

// Only the article files are written here. The index is patched afterwards by
// scripts/sync-index.mjs, which first pulls the newest content - so a long
// translation run can never overwrite stories the newsroom published meanwhile,
// and a timeout cannot throw away finished work.
if (fixedSlugs.size) {
  fs.writeFileSync('translated-slugs.txt', [...fixedSlugs].join('\n') + '\n');
}

console.log(`done: ${fixed} translation(s) written, ${failures.length} still failing`);
for (const f of failures.slice(0, 20)) console.log(`  fail ${f}`);
process.exitCode = failures.length ? 1 : 0;
