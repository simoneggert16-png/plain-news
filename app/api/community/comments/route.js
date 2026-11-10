import { NextResponse } from 'next/server';
import {
  addComment,
  checkCommunityRateLimit,
  isVerifiedCommunityUser,
  listAllComments,
  listComments,
} from '@/lib/communityStore.mjs';
import { moderateContent } from '@/lib/nvidia.mjs';
import { visitorMeta } from '@/lib/visitorMeta.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const requestedLimit = Number(searchParams.get('limit') || 200);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), 200)
      : 200;

    if (!slug) {
      const all = await listAllComments({ limit });
      return NextResponse.json(
        { comments: [], all },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
      );
    }
    if (slug.length > 200) {
      return NextResponse.json({ error: 'Invalid article slug.' }, { status: 400 });
    }

    const list = await listComments(slug, { limit });
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
    if (!checkCommunityRateLimit(request, { scope: 'comments', max: 10, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: 'Zu viele Beiträge in kurzer Zeit. Bitte kurz warten.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const { slug, author, content, parentId, locale } = body || {};

    const validParentId =
      parentId === undefined ||
      parentId === null ||
      (typeof parentId === 'string' && parentId.trim().length > 0 && parentId.length <= 100);

    if (
      typeof slug !== 'string' || !slug.trim() || slug.length > 200 ||
      typeof content !== 'string' || !content.trim() || content.length > 3000 ||
      (author !== undefined && author !== null && (typeof author !== 'string' || author.length > 60)) ||
      !validParentId
    ) {
      return NextResponse.json({ error: 'Slug and valid content are required' }, { status: 400 });
    }

    const cleanSlug = slug.trim();
    const cleanAuthor = (typeof author === 'string' && author.trim()) ? author.trim() : 'Anonym';
    const cleanContent = content.trim();

    const mod = await moderateContent({
      text: cleanContent,
      author: cleanAuthor,
      type: 'comment',
      locale: typeof locale === 'string' ? locale : 'de',
    });
    if (!mod.approved) {
      return NextResponse.json(
        { error: mod.reason || 'Der Kommentar entspricht nicht den Moderationsrichtlinien.', reason: mod.reason },
        { status: 400 }
      );
    }

    const verified = await isVerifiedCommunityUser(request);

    const publicComment = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      author: cleanAuthor,
      date: new Date().toISOString(),
      content: cleanContent,
      parentId: typeof parentId === 'string' ? parentId.trim() : null,
      verified,
    };

    const meta = await visitorMeta(request);
    const updatedComments = await addComment(cleanSlug, publicComment, meta);

    return NextResponse.json({
      success: true,
      comment: publicComment,
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
