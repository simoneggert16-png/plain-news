#!/usr/bin/env node
// Health snapshot of the published archive: how many recent stories carry a
// photo, how many are still missing their German version, and how many are
// constructive/positive. Run after a newsroom cycle:
//   node scripts/content-health.mjs [hours]
import fs from 'node:fs';

const hours = Number(process.argv[2]) || 24;
const index = JSON.parse(fs.readFileSync('content/index.json', 'utf8'));
const since = Date.now() - hours * 36e5;
const recent = index.articles.filter((a) => Date.parse(a.publishedAt) >= since);
const withImage = recent.filter((a) => a.image);
const missingDe = recent.filter((a) => !a.locales?.de?.title);
const pct = (n) => (recent.length ? ((n / recent.length) * 100).toFixed(0) + '%' : '–');

console.log(`Letzte ${hours}h: ${recent.length} Artikel`);
console.log(`  mit Bild:            ${withImage.length} (${pct(withImage.length)})`);
console.log(`  ohne deutsche Fassung: ${missingDe.length} (${pct(missingDe.length)})`);
const byCat = {};
for (const a of recent) byCat[a.category] = (byCat[a.category] || 0) + 1;
console.log('  Ressorts: ' + Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
const positiveShare = recent.filter((a) => ['culture', 'climate', 'science', 'health'].includes(a.category)).length;
console.log(`  konstruktiv (culture/climate/science/health): ${positiveShare} (${pct(positiveShare)})`);
if (missingDe.length) {
  console.log('  Beispiele ohne Deutsch:');
  for (const a of missingDe.slice(0, 5)) console.log('   ', a.slug);
}
if (recent.length && withImage.length < recent.length * 0.5) {
  console.log('\nHinweis: unter 50% mit Bild – Vision-Provider pruefen: Actions -> Vision probe.');
}
