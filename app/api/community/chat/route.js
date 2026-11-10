import { NextResponse } from 'next/server';
import {
  addChatMessage,
  checkCommunityRateLimit,
  isVerifiedCommunityUser,
  listChatMessages,
} from '@/lib/communityStore.mjs';
import { moderateContent } from '@/lib/nvidia.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const messages = await listChatMessages();
    return NextResponse.json({ messages }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (err) {
    console.error('Failed to load community chat:', err);
    return NextResponse.json({ error: 'Community chat could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!checkCommunityRateLimit(request, { scope: 'chat', max: 10, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: 'Zu viele Nachrichten in kurzer Zeit. Bitte kurz warten.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const { user, text, locale } = body || {};

    if (
      typeof text !== 'string' || !text.trim() || text.length > 3000 ||
      (user !== undefined && user !== null && (typeof user !== 'string' || user.length > 60))
    ) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const cleanUser = (typeof user === 'string' && user.trim()) ? user.trim() : 'Leser';
    const cleanText = text.trim();

    const mod = await moderateContent({
      text: cleanText,
      author: cleanUser,
      type: 'chat',
      locale: typeof locale === 'string' ? locale : 'de',
    });
    if (!mod.approved) {
      return NextResponse.json(
        { error: mod.reason || 'Die Nachricht entspricht nicht den Moderationsrichtlinien.', reason: mod.reason },
        { status: 400 }
      );
    }

    const verified = await isVerifiedCommunityUser(request);

    const newMsg = {
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      user: cleanUser,
      text: cleanText,
      date: new Date().toISOString(),
      verified,
    };

    const updated = await addChatMessage(newMsg);

    return NextResponse.json({ success: true, message: newMsg, messages: updated });
  } catch (err) {
    console.error('Error posting chat message:', err);
    return NextResponse.json({ error: 'Chat message could not be saved.' }, { status: 500 });
  }
}
