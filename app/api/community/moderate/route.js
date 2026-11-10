import { NextResponse } from 'next/server';
import { checkCommunityRateLimit, isSameOriginBrowserRequest } from '@/lib/communityStore.mjs';
import { moderateContent } from '@/lib/nvidia.mjs';

export async function POST(request) {
  try {
    if (!isSameOriginBrowserRequest(request)) {
      return NextResponse.json({ approved: false, reason: 'Forbidden origin.' }, { status: 403 });
    }
    if (!checkCommunityRateLimit(request, { scope: 'nvidia-moderate', max: 20, windowMs: 60_000 })) {
      return NextResponse.json({ approved: false, reason: 'Too many moderation requests. Please wait.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const { text, author, type, locale } = body || {};

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ approved: false, reason: 'Text is required.' }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ approved: false, reason: 'Text exceeds 4000 characters.' }, { status: 400 });
    }

    const result = await moderateContent({
      text,
      author: typeof author === 'string' ? author.slice(0, 60) : '',
      type: typeof type === 'string' ? type.slice(0, 30) : 'comment',
      locale: typeof locale === 'string' ? locale.slice(0, 10) : 'de',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/community/moderate:', error);
    return NextResponse.json({ approved: false, reason: 'Moderation check failed.' }, { status: 500 });
  }
}
