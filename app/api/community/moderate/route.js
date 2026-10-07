import { NextResponse } from 'next/server';
import { moderateContent } from '@/lib/nvidia.mjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { text, author, type, locale } = body || {};

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ approved: false, reason: 'Text is required.' }, { status: 400 });
    }

    const result = await moderateContent({
      text,
      author: author || '',
      type: type || 'comment',
      locale: locale || 'de'
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/community/moderate:', error);
    return NextResponse.json({ approved: false, reason: 'Moderation check failed.' }, { status: 500 });
  }
}
