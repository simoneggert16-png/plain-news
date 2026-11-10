import { NextResponse } from 'next/server';
import {
  addSubmission,
  checkCommunityRateLimit,
  isVerifiedCommunityUser,
  listSubmissions,
} from '@/lib/communityStore.mjs';
import { moderateContent } from '@/lib/nvidia.mjs';
import { safeHttpUrl } from '@/lib/safeUrl.mjs';

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
    if (!checkCommunityRateLimit(request, { scope: 'submissions', max: 10, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: 'Zu viele Einreichungen in kurzer Zeit. Bitte kurz warten.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const { title, sourceUrl, summary, author, locale } = body || {};

    if (
      typeof title !== 'string' || !title.trim() || title.length > 200 ||
      typeof sourceUrl !== 'string' || !sourceUrl.trim() || sourceUrl.length > 2048 ||
      typeof summary !== 'string' || !summary.trim() || summary.length > 3000 ||
      (author !== undefined && author !== null && (typeof author !== 'string' || author.length > 60))
    ) {
      return NextResponse.json({ error: 'Title, URL and summary are required' }, { status: 400 });
    }

    const cleanSourceUrl = safeHttpUrl(sourceUrl, '');
    if (!cleanSourceUrl) {
      return NextResponse.json({ error: 'Source URL must be a valid HTTP or HTTPS URL.' }, { status: 400 });
    }

    const cleanTitle = title.trim();
    const cleanSummary = summary.trim();
    const cleanAuthor = (typeof author === 'string' && author.trim()) ? author.trim() : 'Community-Mitglied';

    const mod = await moderateContent({
      text: `${cleanTitle}\n\n${cleanSummary}`,
      author: cleanAuthor,
      type: 'submission',
      locale: typeof locale === 'string' ? locale : 'de',
    });
    if (!mod.approved) {
      return NextResponse.json(
        { error: mod.reason || 'Der Beitrag entspricht nicht den Moderationsrichtlinien.', reason: mod.reason },
        { status: 400 }
      );
    }

    const verified = await isVerifiedCommunityUser(request);

    const newItem = {
      id: 'comm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: cleanTitle,
      sourceUrl: cleanSourceUrl,
      summary: cleanSummary,
      author: cleanAuthor,
      date: new Date().toISOString(),
      verified,
    };

    const updated = await addSubmission(newItem);

    return NextResponse.json({ success: true, item: newItem, submissions: updated });
  } catch (err) {
    console.error('Error posting community submission:', err);
    return NextResponse.json({ error: 'Community contribution could not be saved.' }, { status: 500 });
  }
}
