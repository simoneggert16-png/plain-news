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
// The workflow kills the job at 55 minutes, and a killed job never reaches the
// commit step: a long run then translated for an hour and published nothing,
// which is why the backlog never shrank. Stop taking new articles early enough
// that the finished ones get committed.
const BUDGET_MS = (Number(process.env.TIME_BUDGET_MIN) || 42) * 60_000;
const startedAt = Date.now();
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

// Article files are saved one by one, so the list of finished slugs is written
// the same way: a run that is cut off still commits what it did and the index
// is rebuilt from that list.
const writeSlugFile = () => {
  if (fixedSlugs.size) fs.writeFileSync('translated-slugs.txt', [...fixedSlugs].join('\n') + '\n');
};

async function worker() {
  while (cursor < articleJobs.length && Date.now() - startedAt < BUDGET_MS) {
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
      writeSlugFile();
    }
  }
}

// A worker inside an article with eight locales and retries can run far past
// the budget, and the job's own timeout kills the commit step. Leave the step
// by choice a few minutes before that happens.
const guard = setTimeout(() => {
  console.log(`time budget reached while translating: ${Math.max(0, articleJobs.length - cursor)} article(s) wait for the next run`);
  console.log(`done: ${fixed} translation(s) written, ${failures.length} still failing`);
  writeSlugFile();
  process.exit(0);
}, BUDGET_MS + 6 * 60_000);
guard.unref?.();

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, articleJobs.length) }, worker));
clearTimeout(guard);

// Only the article files are written here. The index is patched afterwards by
// scripts/sync-index.mjs, which first pulls the newest content - so a long
// translation run can never overwrite stories the newsroom published meanwhile,
// and a timeout cannot throw away finished work.
writeSlugFile();

const left = Math.max(0, articleJobs.length - cursor);
if (left) console.log(`time budget reached: ${left} article(s) wait for the next run`);
console.log(`done: ${fixed} translation(s) written, ${failures.length} still failing`);
for (const f of failures.slice(0, 20)) console.log(`  fail ${f}`);
process.exitCode = failures.length ? 1 : 0;
