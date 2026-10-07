import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const newsletterFilePath = path.join(process.cwd(), 'content', 'community', 'newsletter.json');

function readSubscribers() {
  try {
    if (!fs.existsSync(newsletterFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(newsletterFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read newsletter subscribers:', err);
    return [];
  }
}

function writeSubscribers(data) {
  try {
    fs.mkdirSync(path.dirname(newsletterFilePath), { recursive: true });
    fs.writeFileSync(newsletterFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save newsletter subscribers:', err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, topics, locale } = body || {};

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const subscribers = readSubscribers();

    const existingIndex = subscribers.findIndex(s => s.email === cleanEmail);
    const entry = {
      email: cleanEmail,
      subscribedAt: new Date().toISOString(),
      topics: Array.isArray(topics) ? topics : ['world', 'politics', 'business', 'tech', 'science'],
      locale: locale || 'de',
      status: 'active',
    };

    if (existingIndex >= 0) {
      subscribers[existingIndex] = { ...subscribers[existingIndex], ...entry };
    } else {
      subscribers.push(entry);
    }

    writeSubscribers(subscribers);

    return NextResponse.json({ success: true, subscribed: true, email: cleanEmail });
  } catch (err) {
    console.error('Error handling newsletter:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
