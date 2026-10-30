import { NextResponse } from 'next/server';
import { readRemoteListing, searchRemoteArticles, rest } from '@/lib/contentRemote.mjs';
import { getAllArticles } from '@/lib/content.mjs';

export const dynamic = 'force-dynamic';

// Timing probe for the three ways a page can reach the archive. It answers
// one question: where did the seconds go. Only durations and short labels,
// never data.
async function measure(name, fn) {
  const start = Date.now();
  try {
    const value = await fn();
    return { name, ms: Date.now() - start, ok: true, size: Array.isArray(value) ? value.length : (value ? 1 : 0) };
  } catch (err) {
    const message = String(err?.message || err);
    return { name, ms: Date.now() - start, ok: false, error: message.slice(0, 160) };
  }
}

export async function GET() {
  const results = await Promise.all([
    // A cheap query: if this one hangs as well, the database is not answering
    // at all and the payload size is beside the point.
    measure('db_ping', () => rest('articles?select=slug&limit=1')),
    measure('mirror_listing', () => readRemoteListing('en')),
    measure('mirror_search', () => searchRemoteArticles('bitcoin', 10)),
    measure('local_archive', async () => (await getAllArticles()).length),
  ]);
  return NextResponse.json({ at: new Date().toISOString(), results });
}
