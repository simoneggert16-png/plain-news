import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from './supabase-admin.mjs';
import { extractClientIp } from './visitorMeta.mjs';

const MAX_PUBLIC_COMMENTS_LIMIT = 200;
const TRACKING_COLUMNS = ['ip', 'ip_masked', 'ip_hash', 'country', 'region', 'city', 'ua'];

// In-memory sliding-window rate limiter (per serverless instance)
const rateLimitBuckets = new Map();
const MAX_BUCKETS = 5000;

export function checkCommunityRateLimit(request, { scope = 'write', max = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const ip = extractClientIp(request) || 'anonymous-local';
  const key = `${scope}:${ip}`;

  if (rateLimitBuckets.size > MAX_BUCKETS) {
    for (const [k, timestamps] of rateLimitBuckets.entries()) {
      const fresh = timestamps.filter((t) => now - t < windowMs);
      if (fresh.length === 0) rateLimitBuckets.delete(k);
      else rateLimitBuckets.set(k, fresh);
    }
    if (rateLimitBuckets.size > MAX_BUCKETS) {
      const firstKey = rateLimitBuckets.keys().next().value;
      if (firstKey !== undefined) rateLimitBuckets.delete(firstKey);
    }
  }

  const recent = (rateLimitBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    rateLimitBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLimitBuckets.set(key, recent);
  return true;
}

export function isSameOriginBrowserRequest(request) {
  const allowedHosts = new Set([
    'plain-news.ch',
    'www.plain-news.ch',
    'localhost',
    '127.0.0.1',
  ]);
  for (const envHost of [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (envHost) {
      allowedHosts.add(envHost.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase());
    }
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      allowedHosts.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname.toLowerCase());
    } catch {
      // ignore invalid NEXT_PUBLIC_SITE_URL
    }
  }

  const candidate = request.headers.get('origin') || request.headers.get('referer') || '';
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return allowedHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function isVerifiedCommunityUser(request) {
  const authHeader = request?.headers?.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  try {
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) return false;
    return true;
  } catch {
    return false;
  }
}

function mapComment(row) {
  return {
    id: row.id,
    author: row.author,
    date: row.created_at,
    content: row.content,
    parentId: row.parent_id,
    verified: Boolean(row.verified),
  };
}

function mapSubmission(row) {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    summary: row.summary,
    author: row.author,
    date: row.created_at,
    verified: Boolean(row.verified),
  };
}

function mapChatMessage(row) {
  return {
    id: row.id,
    user: row.username,
    text: row.content,
    date: row.created_at,
    verified: Boolean(row.verified),
  };
}

function clampCommentLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_PUBLIC_COMMENTS_LIMIT;
  return Math.min(Math.floor(parsed), MAX_PUBLIC_COMMENTS_LIMIT);
}

function isMissingColumnError(error) {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const combined = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return /column .* does not exist|could not find the .* column|schema cache/i.test(combined);
}

/** Author lookup for the site search. Filters in Postgres: loading every
 *  comment (up to 10 000 rows) just to match a name made search slow. */
export async function searchCommunity(query, { limit = 40 } = {}) {
  const term = String(query || '').trim().replace(/^@+/, '').slice(0, 120);
  if (term.length < 2) return { comments: [], submissions: [], chatMessages: [] };
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const client = getSupabaseAdminClient();
  const [comments, submissions, chat] = await Promise.all([
    client.from('community_comments')
      .select('article_slug, id, author, content, parent_id, created_at, verified')
      .ilike('author', like).order('created_at', { ascending: false }).limit(safeLimit),
    client.from('community_submissions')
      .select('id, title, source_url, summary, author, created_at, verified')
      .ilike('author', like).order('created_at', { ascending: false }).limit(safeLimit),
    client.from('community_chat_messages')
      .select('id, username, content, created_at, verified')
      .ilike('username', like).order('created_at', { ascending: false }).limit(safeLimit),
  ]);
  if (comments.error) throw comments.error;
  if (submissions.error) throw submissions.error;
  if (chat.error) throw chat.error;
  return {
    comments: comments.data.map((row) => ({ ...mapComment(row), slug: row.article_slug })),
    submissions: submissions.data.map(mapSubmission),
    chatMessages: chat.data.map(mapChatMessage),
  };
}

export async function listComments(slug, { limit = MAX_PUBLIC_COMMENTS_LIMIT } = {}) {
  const safeLimit = clampCommentLimit(limit);
  const { data, error } = await getSupabaseAdminClient()
    .from('community_comments')
    .select('id, author, content, parent_id, created_at, verified')
    .eq('article_slug', slug)
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return data.map(mapComment);
}

export async function listAllComments({ limit = MAX_PUBLIC_COMMENTS_LIMIT } = {}) {
  const safeLimit = clampCommentLimit(limit);
  const { data, error } = await getSupabaseAdminClient()
    .from('community_comments')
    .select('article_slug, id, author, content, parent_id, created_at, verified')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return data.reduce((bySlug, row) => {
    (bySlug[row.article_slug] ||= []).push(mapComment(row));
    return bySlug;
  }, {});
}

export async function addComment(slug, comment, trackingMeta = null) {
  const client = getSupabaseAdminClient();
  if (comment.parentId) {
    const { data: parent, error: parentError } = await client
      .from('community_comments')
      .select('id')
      .eq('id', comment.parentId)
      .eq('article_slug', slug)
      .maybeSingle();
    if (parentError) throw parentError;
    if (!parent) throw new Error('The comment being replied to was not found for this article.');
  }

  const baseRow = {
    id: comment.id,
    article_slug: slug,
    author: comment.author,
    content: comment.content,
    parent_id: comment.parentId || null,
    created_at: comment.date,
    verified: Boolean(comment.verified),
  };

  const trackingRow = {};
  for (const col of TRACKING_COLUMNS) {
    const val = trackingMeta?.[col] !== undefined ? trackingMeta[col] : comment[col];
    if (val !== undefined && val !== null && val !== '') {
      trackingRow[col] = val;
    }
  }

  const hasTracking = Object.keys(trackingRow).length > 0;
  let { error } = await client
    .from('community_comments')
    .insert(hasTracking ? { ...baseRow, ...trackingRow } : baseRow);

  if (error && hasTracking && isMissingColumnError(error)) {
    ({ error } = await client.from('community_comments').insert(baseRow));
  }
  if (error) throw error;
  return listComments(slug);
}

export async function listSubmissions() {
  const { data, error } = await getSupabaseAdminClient()
    .from('community_submissions')
    .select('id, title, source_url, summary, author, created_at, verified')
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) throw error;
  return data.map(mapSubmission);
}

export async function addSubmission(submission) {
  const { error } = await getSupabaseAdminClient()
    .from('community_submissions')
    .insert({
      id: submission.id,
      title: submission.title,
      source_url: submission.sourceUrl,
      summary: submission.summary,
      author: submission.author,
      created_at: submission.date,
      verified: Boolean(submission.verified),
    });
  if (error) throw error;
  return listSubmissions();
}

export async function listChatMessages() {
  const { data, error } = await getSupabaseAdminClient()
    .from('community_chat_messages')
    .select('id, username, content, created_at, verified')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map(mapChatMessage);
}

export async function addChatMessage(message) {
  const { error } = await getSupabaseAdminClient()
    .from('community_chat_messages')
    .insert({
      id: message.id,
      username: message.user,
      content: message.text,
      created_at: message.date,
      verified: Boolean(message.verified),
    });
  if (error) throw error;
  return listChatMessages();
}
