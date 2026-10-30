#!/usr/bin/env node
// Writes content/latest.json: the head of the index, in the shape a card needs.
//
// Why: the deployment carries a snapshot of content/, but a build can ship a
// stale one - Vercel restores the files of the last build from its build
// cache, so a story that was published an hour ago is missing from the
// bundle. The repository is the source of truth, and the site reads this file
// from raw.githubusercontent.com at runtime. Then a published story is online
// within a minute, without waiting for the next deployment.
//
//   node scripts/build-latest.mjs [how many]
import fs from 'node:fs';
import path from 'node:path';
import { loadIndex } from '../bots/lib/store.mjs';
import { LISTING_FIELDS } from '../lib/listing.mjs';

const COUNT = Number(process.argv[2] || 120);
const FILE = path.join(process.cwd(), 'content', 'latest.json');

const pick = (obj, keys) => {
  const out = {};
  for (const key of keys) {
    const value = obj?.[key];
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
};

const index = loadIndex();
const articles = (index.articles || [])
  .filter((a) => a?.slug)
  .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
  .slice(0, COUNT)
  .map((a) => {
    const entry = pick(a, LISTING_FIELDS);
    const locales = {};
    for (const [code, loc] of Object.entries(a.locales || {})) {
      const slim = pick(loc, ['title', 'dek', 'standfirst']);
      if (slim.title || slim.dek) locales[code] = slim;
    }
    if (Object.keys(locales).length) entry.locales = locales;
    return entry;
  });

fs.writeFileSync(FILE, `${JSON.stringify({ updatedAt: new Date().toISOString(), articles })}\n`);
console.log(`latest.json: ${articles.length} entries, ${(fs.statSync(FILE).size / 1024).toFixed(0)} KB`);
