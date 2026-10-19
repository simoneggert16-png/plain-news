#!/usr/bin/env node
// PLAIN. MAINTENANCE — runs daily. Keeps the site healthy without a human:
//   • validates every article file, removes broken ones
//   • removes duplicates (same headline)
//   • deletes stories older than RETENTION_DAYS (keeps repo + builds small)
//   • retries missing translations
//   • rebuilds index.json from disk (self-healing)
//   • writes content/health.json with a status report
//
// IMPORTANT: maintenance never deletes a story just because it has one source.
// Source policy is enforced by the newsroom when a story is created. Retroactively
// deleting valid single-source stories was the bug that emptied the site.
import { loadIndex, saveIndex, loadState, listArticleFiles, loadArticle, saveArticle, deleteArticle, toIndexEntry } from './lib/store.mjs';
import { translate } from './lib/translate.mjs';
import { LOCALES, SOURCE_LOCALE, CATEGORIES } from '../lib/config.mjs';
import { isStructurallyValid, classifySources } from '../lib/editorial.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT } from './lib/store.mjs';

const RETENTION_DAYS = +(process.env.RETENTION_DAYS || 45);
const MAX_TRANSLATION_FIXES = +(process.env.MAX_TRANSLATION_FIXES || 30);
const DRY_RUN = process.env.DRY_RUN === '1';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const report = {
    at: new Date().toISOString(),
    dryRun: DRY_RUN,
    checked: 0,
    removedInvalid: [],
    removedInvalidReasons: {},
    removedDuplicate: [],
    removedOld: [],
    translationsFixed: 0,
    translationsFailed: 0,
    sourcePolicies: { 'two-source': 0, primary: 0, insufficient: 0 },
  };
  const cutoff = Date.now() - RETENTION_DAYS * 864e5;
  const titles = new Map();
  const keep = [];

  const slugs = listArticleFiles();
  log(`Checking ${slugs.length} articles…${DRY_RUN ? ' (dry run)' : ''}`);
  const articles = slugs.map((s) => [s, loadArticle(s)]).sort((a, b) => Date.parse(b[1]?.publishedAt || 0) - Date.parse(a[1]?.publishedAt || 0));

  for (const [slug, a] of articles) {
    report.checked++;
    const check = isStructurallyValid(a);
    if (!check.ok || a.slug !== slug) {
      const reason = check.ok ? 'slug-mismatch' : check.reason;
      if (!DRY_RUN) deleteArticle(slug);
      report.removedInvalid.push(slug);
      report.removedInvalidReasons[slug] = reason;
      log(`  ✗ invalid ${slug}: ${reason}`);
      continue;
    }
    if (Date.parse(a.publishedAt) < cutoff) {
      if (!DRY_RUN) deleteArticle(slug);
      report.removedOld.push(slug);
      continue;
    }
    const key = norm(a.locales[SOURCE_LOCALE].title);
    if (titles.has(key)) {
      if (!DRY_RUN) deleteArticle(slug);
      report.removedDuplicate.push(slug);
      continue;
    }
    titles.set(key, slug);
    const policy = a.sourcePolicy || classifySources(a.sources).policy;
    report.sourcePolicies[policy] = (report.sourcePolicies[policy] || 0) + 1;
    keep.push(a);
  }

  // Retry missing translations (newest first, capped per run to respect free-tier limits).
  if (!DRY_RUN) {
    let budget = MAX_TRANSLATION_FIXES;
    for (const a of keep) {
      const missing = LOCALES.map((l) => l.code).filter((c) => !a.locales[c]);
      if (!missing.length || budget <= 0) continue;
      for (const l of missing) {
        if (budget-- <= 0) break;
        try {
          a.locales[l] = await translate(a.locales[SOURCE_LOCALE], l);
          report.translationsFixed++;
          log(`  + ${l} ${a.slug}`);
        } catch (e) {
          report.translationsFailed++;
          log(`  ✗ ${l} ${a.slug}: ${e.message}`);
        }
      }
      saveArticle(a);
    }
  }

  // Rebuild the index from disk.
  const state = loadState();
  report.articles = keep.length;
  report.lastNewsroomRun = state.runs?.[0] || null;
  report.byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, keep.filter((a) => a.category === c).length]));

  if (DRY_RUN) {
    log(`DRY RUN. ${keep.length} articles would be kept · invalid ${report.removedInvalid.length} · dup ${report.removedDuplicate.length} · old ${report.removedOld.length}`);
    log(`Source policies: ${JSON.stringify(report.sourcePolicies)}`);
    return;
  }

  saveIndex({ articles: keep.map(toIndexEntry) });
  fs.writeFileSync(path.join(CONTENT, 'health.json'), JSON.stringify(report, null, 2) + '\n');

  log(`Done. ${keep.length} articles kept · invalid ${report.removedInvalid.length} · dup ${report.removedDuplicate.length} · old ${report.removedOld.length} · translations +${report.translationsFixed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
