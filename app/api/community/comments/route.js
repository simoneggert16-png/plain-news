import { NextResponse } from 'next/server';
import { getCommentsForSlug, addCommentToCloud, fetchAllComments } from '@/lib/cloudStore.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      const all = await fetchAllComments();
      return NextResponse.json({ comments: [], all });
    }

    const list = await getCommentsForSlug(slug);
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
    return NextResponse.json({ comments: [] });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, author, content } = body || {};

    if (!slug || !content || !content.trim()) {
      return NextResponse.json({ error: 'Slug and content are required' }, { status: 400 });
    }

    const newComment = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      author: (author && author.trim()) || 'Anonym',
      date: new Date().toISOString(),
      content: content.trim(),
      verified: true,
    };

    const updatedComments = await addCommentToCloud(slug, newComment);

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
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
