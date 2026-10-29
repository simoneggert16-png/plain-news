#!/usr/bin/env node
// Refuse to commit a broken content index.
//
// A translations run once committed content/index.json with unresolved merge
// conflict markers (autostash pop during `git pull --rebase --autostash`), which
// made the file unparseable and emptied the front page. Every workflow that
// commits content/ runs this first.
//
//   node scripts/check-content.mjs        # fail on conflict markers / bad JSON
//   node scripts/check-content.mjs --fix  # also resolve an updatedAt-only conflict
import fs from 'node:fs';
import path from 'node:path';

const INDEX = path.join(process.cwd(), 'content', 'index.json');
const fix = process.argv.includes('--fix');
const MARKER = /<<<<<<< [^\r\n]*\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\r\n]*\r?\n/g;

let raw = fs.readFileSync(INDEX, 'utf8');
const hunks = [...raw.matchAll(MARKER)];

if (hunks.length) {
  // Both sides of this conflict are just the index timestamp; the article list
  // merged cleanly. Any other conflict shape is left for a human.
  const onlyTimestamp = hunks.every((m) =>
    [m[1], m[2]].every((side) => /^"updatedAt":\s*"[^"]*",?$/.test(side.trim()))
  );
  if (!fix || !onlyTimestamp) {
    console.error(`content/index.json has ${hunks.length} unresolved merge conflict(s) - refusing to continue.`);
    process.exit(1);
  }
  raw = raw.replace(MARKER, (_, a, b) => (a.trim() > b.trim() ? a : b));
  fs.writeFileSync(INDEX, raw);
  console.log('content/index.json: resolved updatedAt-only merge conflict');
}

let index;
try {
  index = JSON.parse(raw);
} catch (err) {
  console.error(`content/index.json is not valid JSON: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(index.articles) || !index.articles.length) {
  console.error('content/index.json contains no articles - refusing to continue.');
  process.exit(1);
}

const missing = index.articles.filter(
  (a) => !fs.existsSync(path.join(process.cwd(), 'content', 'articles', `${a.slug}.json`))
);
console.log(`content/index.json OK: ${index.articles.length} entries`);
if (missing.length) {
  console.warn(`${missing.length} entries have no article file, e.g. ${missing[0].slug}`);
}
