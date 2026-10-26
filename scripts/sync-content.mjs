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

async function rest(pathAndQuery, { key = serviceKey, method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { ...headers(key), ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${(await res.text()).slice(0, 400)}`);
  if (res.status === 204) return null;
  return res.json();
}

async function countRows(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: { ...headers(readKey), Prefer: 'count=exact' },
    signal: AbortSignal.timeout(30000),
  });
  const range = res.headers.get('content-range') || '';
  return Number(range.split('/').pop() || 0);
}

async function verify(localIndexCount) {
  const indexRows = await rest('content_blobs?key=eq.index&select=data', { key: readKey });
  const remoteIndexCount = indexRows?.[0]?.data?.articles?.length || 0;
  const remoteArticles = await countRows('articles');
  console.log(`local : index ${localIndexCount} entries, ${fs.readdirSync(ARTICLES_DIR).length} article files`);
  console.log(`remote: index ${remoteIndexCount} entries, ${remoteArticles} article rows`);
  const ok = remoteIndexCount === localIndexCount && remoteArticles >= localIndexCount;
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
  const ok = await verify(entries.length);
  process.exit(ok ? 0 : 2);
}

console.log(`index: ${entries.length} entries, articles: ${articles.length} files`);
if (dryRun) {
  console.log('dry run – nothing written');
  process.exit(0);
}

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing; refusing to write.');
  process.exit(1);
}

await rest('content_blobs?on_conflict=key', {
  method: 'POST',
  body: [{ key: 'index', data: index, updated_at: new Date().toISOString() }],
  prefer: 'resolution=merge-duplicates,return=minimal',
});
console.log('index uploaded');

const batchSize = 25;
for (let i = 0; i < articles.length; i += batchSize) {
  const batch = articles.slice(i, i + batchSize).map((article) => ({
    slug: article.slug,
    published_at: article.publishedAt || null,
    updated_at: new Date().toISOString(),
    data: article,
  }));
  await rest('articles?on_conflict=slug', {
    method: 'POST',
    body: batch,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  process.stdout.write(`\rarticles: ${Math.min(i + batchSize, articles.length)}/${articles.length}`);
}
process.stdout.write('\n');

const ok = await verify(entries.length);
process.exit(ok ? 0 : 2);
