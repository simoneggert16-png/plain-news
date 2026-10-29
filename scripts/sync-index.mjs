#!/usr/bin/env node
// Patch content/index.json from freshly written article files.
//
// Translation runs write only content/articles/*.json (so a long run cannot
// overwrite the index a newsroom cycle pushed meanwhile). This script is run
// afterwards, on top of a fresh pull, and only touches the given slugs.
//
//   node scripts/sync-index.mjs slug-a slug-b
//   node scripts/sync-index.mjs --file translated-slugs.txt
//   node scripts/sync-index.mjs --missing      # entries whose file vanished from the index
//   node scripts/sync-index.mjs --all          # regenerate every entry from its article file
import fs from 'node:fs';
import { loadIndex, saveIndex, loadArticle, toIndexEntry, listArticleFiles } from '../bots/lib/store.mjs';

const args = process.argv.slice(2);

// Index entries are written once, when an article is published. Translations
// added later never reach them, so the front page kept showing English titles
// for stories whose German version existed all along. --all regenerates them.
if (args[0] === '--all') {
  const index = loadIndex();
  const bySlug = new Map(index.articles.map((a) => [a.slug, a]));
  let refreshed = 0;
  let added = 0;
  for (const slug of listArticleFiles()) {
    const article = loadArticle(slug);
    if (!article?.locales) continue;
    const entry = toIndexEntry(article);
    const prev = bySlug.get(slug);
    if (prev && JSON.stringify(prev) !== JSON.stringify(entry)) refreshed++;
    else if (!prev) added++;
    bySlug.set(slug, entry);
  }
  if (refreshed || added) saveIndex({ articles: [...bySlug.values()] });
  console.log(`sync-index: ${refreshed} refreshed, ${added} added`);
  process.exit(0);
}

// After a merge that kept one side of content/index.json, entries the other
// side had added are gone although their article file is present. Rebuild them.
if (args[0] === '--missing') {
  const index = loadIndex();
  const known = new Set(index.articles.map((a) => a.slug));
  let added = 0;
  for (const slug of listArticleFiles()) {
    if (known.has(slug)) continue;
    const article = loadArticle(slug);
    if (!article?.locales) continue;
    index.articles.push(toIndexEntry(article));
    added++;
  }
  if (added) saveIndex(index);
  console.log(`sync-index: ${added} missing entry/entries restored`);
  process.exit(0);
}

let slugs = args;
if (args[0] === '--file') {
  const file = args[1];
  slugs = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    : [];
}
if (!slugs.length) {
  console.log('sync-index: nothing to do');
  process.exit(0);
}

const index = loadIndex();
let patched = 0;
for (const slug of new Set(slugs)) {
  const article = loadArticle(slug);
  if (!article) continue;
  const entry = toIndexEntry(article);
  const i = index.articles.findIndex((x) => x.slug === slug);
  if (i >= 0) index.articles[i] = entry;
  else index.articles.push(entry);
  patched++;
}
if (patched) saveIndex(index);
console.log(`sync-index: ${patched} entry/entries updated`);
