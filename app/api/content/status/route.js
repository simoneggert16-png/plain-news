import { NextResponse } from 'next/server';
import { contentSource, getIndex } from '@/lib/content.mjs';
import { remoteReadEnabled } from '@/lib/contentRemote.mjs';

export const dynamic = 'force-dynamic';

// Small health probe: which store is serving the site and how many stories does
// it see? Used to decide whether content/ can be dropped from deployments.
export async function GET() {
  try {
    const index = await getIndex();
    return NextResponse.json({
      source: contentSource,
      remoteConfigured: remoteReadEnabled,
      articles: index.length,
      newest: index[0]?.publishedAt || null,
      oldest: index[index.length - 1]?.publishedAt || null,
    });
  } catch (err) {
    return NextResponse.json({ source: contentSource, error: err.message }, { status: 500 });
  }
}
