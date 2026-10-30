#!/usr/bin/env node
// Mirror the git-tracked content store to Supabase.
//
//   node scripts/sync-content.mjs            # upsert index + all articles
//   node scripts/sync-content.mjs --dry-run  # report only
//   node scripts/sync-content.mjs --verify   # read back and compare counts
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Actions secret or .env).
// The website reads the same rows with the anon key (RLS: SELECT only), so
// article JSON no longer has to travel inside every Vercel deployment.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { LOCALES } from '../lib/config.mjs';
import { buildListing, listingKey } from '../lib/listing.mjs';

if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      if (!process.env[key]) process.env[key] = trimmed.slice(idx + 1).trim();
    }
  }
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const verifyOnly = args.has('--verify');

// The whole mirror gets a budget of its own. A stalled upload must not eat
// the step timeout: the work that matters (listings, new articles) is written
// first, and whatever is left over simply continues in the next run.
const DEADLINE_MS = Number(process.env.SYNC_DEADLINE_MS || 8 * 60 * 1000);
const startedAt = Date.now();
const outOfTime = () => Date.now() - startedAt > DEADLINE_MS;

const CONTENT_DIR = path.join(process.cwd(), 'content');
const ARTICLES_DIR = path.join(CONTENT_DIR, 'articles');
const INDEX_FILE = path.join(CONTENT_DIR, 'index.json');

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const readKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url) {
  console.error('SUPABASE_URL is missing.');
  process.exit(1);
}

const headers = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

async function rest(pathAndQuery, { key = serviceKey, method = 'GET', body, prefer, timeoutMs = 30000 } = {}) {
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { ...headers(key), ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${(await res.text()).slice(0, 400)}`);
  // Upserts with `return=minimal` answer 201 with an empty body - res.json()
  // throws "Unexpected end of JSON input" on that.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const hash = (value) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);

async function countRows(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: { ...headers(readKey), Prefer: 'count=exact' },
    signal: AbortSignal.timeout(30000),
  });
  const range = res.headers.get('content-range') || '';
  return Number(range.split('/').pop() || 0);
}

async function verify(localIndexCount, localArticleCount) {
  const indexRows = await rest('content_blobs?key=eq.index&select=data', { key: readKey });
  const remoteIndexCount = indexRows?.[0]?.data?.articles?.length || 0;
  const remoteArticles = await countRows('articles');
  console.log(`local : index ${localIndexCount} entries, ${localArticleCount} readable article files`);
  console.log(`remote: index ${remoteIndexCount} entries, ${remoteArticles} article rows`);
  const ok = remoteIndexCount === localIndexCount && remoteArticles >= localArticleCount;
  console.log(ok ? 'OK – mirror is complete.' : 'MISMATCH – re-run the sync.');
  return ok;
}

const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
const entries = Array.isArray(index.articles) ? index.articles : [];
const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.json'));
const articles = files
  .map((file) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8'));
    } catch (err) {
      console.warn(`skip unreadable ${file}: ${err.message}`);
      return null;
    }
  })
  .filter((a) => a && a.slug);

if (verifyOnly) {
  const ok = await verify(entries.length, articles.length);
  process.exitCode = ok ? 0 : 2;
} else {
  console.log(`index: ${entries.length} entries, articles: ${articles.length} files`);
  if (dryRun) {
    console.log('dry run – nothing written');
  } else if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is missing; refusing to write.');
    process.exitCode = 1;
  } else {
    await writeMirror();
  }
}

// Set exitCode instead of calling process.exit(): exiting while the undici
// connections are still closing has crashed Node 24 on Windows (libuv assert).
async function writeMirror() {
  // Four workflows mirror the content into Supabase, and every one of them
  // used to upload the whole archive again. 26 MB of upserts left the database
  // so busy that the website had to wait seconds for every read. A hash of
  // what is already there turns the mirror into a delta.
  const known = await readHashes();
  const nextArticles = { ...(known?.articles || {}) };
  const nextListings = { ...(known?.listings || {}) };
  // The index is only "current" once it really landed in the database. A
  // failed upload has to be tried again in the next run.
  let indexSum = known?.index || null;

  // The slim list indexes come first. They are small, they are what the
  // pages actually read, and a slow upload of the full index must never keep
  // the site waiting for megabytes.
  for (const locale of LOCALES) {
    const listing = buildListing(entries, locale.code);
    const sum = hash(JSON.stringify(listing));
    const unchanged = known && known.listings?.[locale.code] === sum;
    nextListings[locale.code] = sum;
    if (unchanged) continue;
    try {
      await rest('content_blobs?on_conflict=key', {
        method: 'POST',
        body: [{ key: listingKey(locale.code), data: { articles: listing }, updated_at: new Date().toISOString() }],
        prefer: 'resolution=merge-duplicates,return=minimal',
        timeoutMs: 60000,
      });
      console.log(`list index ${locale.code}: ${listing.length} entries`);
    } catch (err) {
      console.error(`list index ${locale.code} failed: ${err.message}`);
      delete nextListings[locale.code];
    }
  }

  const batchSize = 25;
  let failed = 0;
  let uploaded = 0;
  let skipped = 0;
  const pending = [];
  for (const article of articles) {
    const sum = hash(JSON.stringify(article));
    if (known && known.articles?.[article.slug] === sum) continue;
    pending.push({ article, sum });
  }
  for (let i = 0; i < pending.length; i += batchSize) {
    if (outOfTime()) {
      skipped = pending.length - i;
      console.log(`budget spent: ${skipped} article(s) stay for the next run`);
      break;
    }
    const batch = pending.slice(i, i + batchSize);
    try {
      await rest('articles?on_conflict=slug', {
        method: 'POST',
        body: batch.map(({ article }) => ({
          slug: article.slug,
          published_at: article.publishedAt || null,
          updated_at: new Date().toISOString(),
          data: article,
        })),
        prefer: 'resolution=merge-duplicates,return=minimal',
        timeoutMs: 45000,
      });
      for (const { article, sum } of batch) nextArticles[article.slug] = sum;
      uploaded += batch.length;
      // The map is written after every batch: a run that is cut short leaves
      // behind what it managed to upload, and the next run continues there.
      await writeHashMap(indexSum, nextListings, nextArticles);
    } catch (err) {
      // One bad batch must not cost the whole mirror.
      failed++;
      console.error(`\narticles ${i}-${i + batch.length} failed: ${err.message}`);
    }
  }
  console.log(`\narticles: ${uploaded} uploaded, ${articles.length - uploaded - skipped} unchanged${skipped ? `, ${skipped} deferred` : ''}`);

  // The full index is eight megabytes. Writing it made the database so busy
  // that every page had to wait for it, and the site does not need it: the
  // snapshot that ships with the deployment serves the crawler routes, and the
  // list indexes plus the articles are what the pages actually read. The old
  // row is removed once so the database keeps that memory for the articles.
  const fullSum = hash(JSON.stringify(index));
  if (!known?.indexRemoved) {
    try {
      await rest('content_blobs?key=eq.index', { method: 'DELETE', timeoutMs: 30000 });
      console.log('full index row removed');
    } catch (err) {
      console.error(`removing the index row failed: ${err.message}`);
    }
    await writeHashMap(indexSum, nextListings, nextArticles, true);
  } else if (indexSum !== known.index) {
    console.log('index is local only - nothing to upload');
  }

  // Stories that are no longer in the repository must leave the mirror too.
  const localSlugs = new Set(articles.map((a) => a.slug));
  const gone = Object.keys(nextArticles).filter((slug) => !localSlugs.has(slug));
  for (const slug of gone) {
    if (outOfTime()) break;
    try {
      await rest(`articles?slug=eq.${encodeURIComponent(slug)}`, { method: 'DELETE', timeoutMs: 30000 });
      delete nextArticles[slug];
      console.log(`removed ${slug}`);
    } catch (err) {
      console.error(`removing ${slug} failed: ${err.message}`);
    }
  }

  await writeHashMap(indexSum, nextListings, nextArticles);

  if (failed) console.error(`${failed} batch(es) failed`);

  const ok = await verify(entries.length, articles.length);
  process.exitCode = ok ? 0 : 2;
}

async function writeHashMap(indexSum, listings, articles, indexRemoved = false) {
  try {
    await rest('content_blobs?on_conflict=key', {
      method: 'POST',
      body: [{ key: 'hashes', data: { index: indexSum, listings, articles, indexRemoved }, updated_at: new Date().toISOString() }],
      prefer: 'resolution=merge-duplicates,return=minimal',
      timeoutMs: 60000,
    });
  } catch (err) {
    console.error(`hash map failed: ${err.message}`);
  }
}

async function readHashes() {
  try {
    const rows = await rest('content_blobs?key=eq.hashes&select=data', { key: readKey, timeoutMs: 30000 });
    const data = rows?.[0]?.data;
    if (data && typeof data === 'object' && data.articles) return data;
    return null;
  } catch (err) {
    console.warn(`no hash map on file (${err.message}) - everything is written once`);
    return null;
  }
}
