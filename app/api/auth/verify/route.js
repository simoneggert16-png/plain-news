import { NextResponse } from 'next/server';
import { verifyTokenInCloud } from '@/lib/cloudStore.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const result = await verifyTokenInCloud(token, email);
    if (!result.valid) {
      return NextResponse.json({ error: result.error || 'Invalid or expired token' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      email: result.email,
      username: result.username,
      verifiedAt: result.verifiedAt || new Date().toISOString(),
    });
  } catch (err) {
    console.error('Verify API error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
