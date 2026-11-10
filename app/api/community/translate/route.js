import { NextResponse } from 'next/server';
import { checkCommunityRateLimit, isSameOriginBrowserRequest } from '@/lib/communityStore.mjs';
import { translateContent } from '@/lib/nvidia.mjs';

export async function POST(request) {
  try {
    if (!isSameOriginBrowserRequest(request)) {
      return NextResponse.json({ error: 'Forbidden origin.', translatedText: '' }, { status: 403 });
    }
    if (!checkCommunityRateLimit(request, { scope: 'nvidia-translate', max: 20, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many translation requests.', translatedText: '' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const { text, targetLocale } = body || {};

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ translatedText: '' }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: 'Text exceeds 4000 characters.', translatedText: '' }, { status: 400 });
    }

    const result = await translateContent({
      text,
      targetLocale: typeof targetLocale === 'string' ? targetLocale.slice(0, 10) : 'de',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/community/translate:', error);
    return NextResponse.json({ translatedText: '' }, { status: 500 });
  }
}
