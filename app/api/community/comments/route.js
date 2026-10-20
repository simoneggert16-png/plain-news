import { NextResponse } from 'next/server';
import { addComment, listAllComments, listComments } from '@/lib/communityStore.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      const all = await listAllComments();
      return NextResponse.json({ comments: [], all });
    }
    if (slug.length > 200) {
      return NextResponse.json({ error: 'Invalid article slug.' }, { status: 400 });
    }

    const list = await listComments(slug);
    return NextResponse.json({
      comments: list,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    console.error('Comments GET error:', err);
    return NextResponse.json({ error: 'Comments could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, author, content } = body || {};

    if (typeof slug !== 'string' || !slug.trim() || slug.length > 200
      || typeof content !== 'string' || !content.trim() || content.length > 1000
      || (author !== undefined && (typeof author !== 'string' || author.length > 50))) {
      return NextResponse.json({ error: 'Slug and content are required' }, { status: 400 });
    }

    const newComment = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      author: (author && author.trim()) || 'Anonym',
      date: new Date().toISOString(),
      content: content.trim(),
      verified: true,
    };

    const updatedComments = await addComment(slug.trim(), newComment);

    return NextResponse.json({
      success: true,
      comment: newComment,
      comments: updatedComments,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Error posting comment:', err);
    return NextResponse.json({ error: 'Comment could not be saved.' }, { status: 500 });
  }
}
