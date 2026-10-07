import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const commentsFilePath = path.join(process.cwd(), 'content', 'community', 'comments.json');

function readComments() {
  try {
    if (!fs.existsSync(commentsFilePath)) {
      return {};
    }
    const raw = fs.readFileSync(commentsFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read comments:', err);
    return {};
  }
}

function writeComments(data) {
  try {
    fs.mkdirSync(path.dirname(commentsFilePath), { recursive: true });
    fs.writeFileSync(commentsFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save comments:', err);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  const allComments = readComments();

  if (!slug) {
    return NextResponse.json({ comments: [] });
  }

  const list = allComments[slug] || [];
  return NextResponse.json({ comments: list });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, author, content } = body || {};

    if (!slug || !content || !content.trim()) {
      return NextResponse.json({ error: 'Slug and content are required' }, { status: 400 });
    }

    const allComments = readComments();
    if (!allComments[slug]) {
      allComments[slug] = [];
    }

    const newComment = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      author: (author && author.trim()) || 'Anonym',
      date: new Date().toISOString(),
      content: content.trim(),
      verified: true,
    };

    // Prepend new comment
    allComments[slug] = [newComment, ...allComments[slug]];
    writeComments(allComments);

    return NextResponse.json({ success: true, comment: newComment, comments: allComments[slug] });
  } catch (err) {
    console.error('Error posting comment:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
