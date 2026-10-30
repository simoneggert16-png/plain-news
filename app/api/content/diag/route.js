import { NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';
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

// Which layer of the connection dies: the name, the socket, or the answer.
// The host name itself is not printed - only phases, durations and error
// codes.
async function measureNetwork() {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { name: 'db_network', ok: false, error: 'no database url configured' };
  const host = new URL(base).hostname;

  const start = Date.now();
  let dnsResult;
  try {
    await dns.lookup(host);
    dnsResult = { ok: true, ms: Date.now() - start };
  } catch (err) {
    dnsResult = { ok: false, ms: Date.now() - start, error: String(err?.code || err?.message || err).slice(0, 80) };
  }

  const tcpStart = Date.now();
  const tcp = await new Promise((resolve) => {
    const socket = net.connect({ host, port: 443 });
    const finish = (ok, error) => {
      socket.destroy();
      resolve({ ok, ms: Date.now() - tcpStart, ...(error ? { error } : {}) });
    };
    socket.setTimeout(5000);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false, 'timeout'));
    socket.on('error', (err) => finish(false, String(err?.code || err?.message || err).slice(0, 80)));
  });

  return { name: 'db_network', ok: dnsResult.ok && tcp.ok, dns: dnsResult, tcp };
}

export async function GET() {
  const results = await Promise.all([
    // A cheap query: if this one hangs as well, the database is not answering
    // at all and the payload size is beside the point.
    measure('db_ping', () => rest('articles?select=slug&limit=1')),
    measure('mirror_listing', () => readRemoteListing('en')),
    measure('mirror_search', () => searchRemoteArticles('bitcoin', 10)),
    measure('local_archive', async () => (await getAllArticles()).length),
    measureNetwork(),
  ]);
  return NextResponse.json({ at: new Date().toISOString(), results });
}
