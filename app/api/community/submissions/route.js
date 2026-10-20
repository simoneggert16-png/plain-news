import { NextResponse } from 'next/server';
import { addSubmission, listSubmissions } from '@/lib/communityStore.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const submissions = await listSubmissions();
    return NextResponse.json({ submissions }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (err) {
    console.error('Failed to load community submissions:', err);
    return NextResponse.json({ error: 'Community submissions could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, sourceUrl, summary, author } = body || {};

    if (typeof title !== 'string' || !title.trim() || title.length > 200
      || typeof sourceUrl !== 'string' || !sourceUrl.trim() || sourceUrl.length > 2048
      || typeof summary !== 'string' || !summary.trim() || summary.length > 3000
      || (author !== undefined && (typeof author !== 'string' || author.length > 50))) {
      return NextResponse.json({ error: 'Title, URL and summary are required' }, { status: 400 });
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      return NextResponse.json({ error: 'Source URL must be a valid HTTP or HTTPS URL.' }, { status: 400 });
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Source URL must use HTTP or HTTPS.' }, { status: 400 });
    }
    const newItem = {
      id: 'comm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      sourceUrl: sourceUrl.trim(),
      summary: summary.trim(),
      author: (author && author.trim()) || 'Community-Mitglied',
      date: new Date().toISOString(),
      verified: true,
    };

    const updated = await addSubmission(newItem);

    return NextResponse.json({ success: true, item: newItem, submissions: updated });
  } catch (err) {
    console.error('Error posting community submission:', err);
    return NextResponse.json({ error: 'Community contribution could not be saved.' }, { status: 500 });
  }
}
