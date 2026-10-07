import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const submissionsFilePath = path.join(process.cwd(), 'content', 'community', 'submissions.json');

function readSubmissions() {
  try {
    if (!fs.existsSync(submissionsFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(submissionsFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read submissions:', err);
    return [];
  }
}

function writeSubmissions(data) {
  try {
    fs.mkdirSync(path.dirname(submissionsFilePath), { recursive: true });
    fs.writeFileSync(submissionsFilePath, JSON.stringify(data.slice(0, 150), null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save submissions:', err);
  }
}

export async function GET() {
  const submissions = readSubmissions();
  return NextResponse.json({ submissions });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, sourceUrl, summary, author } = body || {};

    if (!title || !sourceUrl || !summary) {
      return NextResponse.json({ error: 'Title, URL and summary are required' }, { status: 400 });
    }

    const items = readSubmissions();
    const newItem = {
      id: 'comm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      sourceUrl: sourceUrl.trim(),
      summary: summary.trim(),
      author: (author && author.trim()) || 'Community-Mitglied',
      date: new Date().toISOString(),
      verified: true,
    };

    const updated = [newItem, ...items];
    writeSubmissions(updated);

    return NextResponse.json({ success: true, item: newItem, submissions: updated });
  } catch (err) {
    console.error('Error posting community submission:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
