import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const chatFilePath = path.join(process.cwd(), 'content', 'community', 'chat.json');

function readChat() {
  try {
    if (!fs.existsSync(chatFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(chatFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read chat:', err);
    return [];
  }
}

function writeChat(data) {
  try {
    fs.mkdirSync(path.dirname(chatFilePath), { recursive: true });
    fs.writeFileSync(chatFilePath, JSON.stringify(data.slice(0, 200), null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save chat:', err);
  }
}

export async function GET() {
  const messages = readChat();
  return NextResponse.json({ messages });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { user, text } = body || {};

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const messages = readChat();
    const newMsg = {
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      user: (user && user.trim()) || 'Leser',
      text: text.trim(),
      date: new Date().toISOString(),
      verified: true,
    };

    const updated = [newMsg, ...messages];
    writeChat(updated);

    return NextResponse.json({ success: true, message: newMsg, messages: updated });
  } catch (err) {
    console.error('Error posting chat message:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
