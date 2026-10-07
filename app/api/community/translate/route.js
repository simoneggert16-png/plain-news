import { NextResponse } from 'next/server';
import { translateContent } from '@/lib/nvidia.mjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { text, targetLocale } = body || {};

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ translatedText: '' }, { status: 400 });
    }

    const result = await translateContent({
      text,
      targetLocale: targetLocale || 'de'
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/community/translate:', error);
    return NextResponse.json({ translatedText: '' }, { status: 500 });
  }
}
