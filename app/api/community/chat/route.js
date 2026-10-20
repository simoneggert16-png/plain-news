import { NextResponse } from 'next/server';
import { addChatMessage, listChatMessages } from '@/lib/communityStore.mjs';

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
    const body = await request.json();
    const { user, text } = body || {};

    if (typeof text !== 'string' || !text.trim() || text.length > 500
      || (user !== undefined && (typeof user !== 'string' || user.length > 40))) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const newMsg = {
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      user: (user && user.trim()) || 'Leser',
      text: text.trim(),
      date: new Date().toISOString(),
      verified: true,
    };

    const updated = await addChatMessage(newMsg);

    return NextResponse.json({ success: true, message: newMsg, messages: updated });
  } catch (err) {
    console.error('Error posting chat message:', err);
    return NextResponse.json({ error: 'Chat message could not be saved.' }, { status: 500 });
  }
}
