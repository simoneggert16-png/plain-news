import { getSupabaseAdminClient } from './supabase-admin.mjs';

function mapComment(row) {
  return {
    id: row.id,
    author: row.author,
    date: row.created_at,
    content: row.content,
    parentId: row.parent_id,
    verified: row.verified,
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
    verified: row.verified,
  };
}

function mapChatMessage(row) {
  return {
    id: row.id,
    user: row.username,
    text: row.content,
    date: row.created_at,
    verified: row.verified,
  };
}

/** Author lookup for the site search. Filters in Postgres: loading every
 *  comment (up to 10 000 rows) just to match a name made search slow. */
export async function searchCommunity(query, { limit = 40 } = {}) {
  const term = String(query || '').trim().replace(/^@+/, '');
  if (term.length < 2) return { comments: [], submissions: [], chatMessages: [] };
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const client = getSupabaseAdminClient();
  const [comments, submissions, chat] = await Promise.all([
    client.from('community_comments')
      .select('article_slug, id, author, content, parent_id, created_at, verified')
      .ilike('author', like).order('created_at', { ascending: false }).limit(limit),
    client.from('community_submissions')
      .select('id, title, source_url, summary, author, created_at, verified')
      .ilike('author', like).order('created_at', { ascending: false }).limit(limit),
    client.from('community_chat_messages')
      .select('id, username, content, created_at, verified')
      .ilike('username', like).order('created_at', { ascending: false }).limit(limit),
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

export async function listComments(slug) {
  const { data, error } = await getSupabaseAdminClient()
    .from('community_comments')
    .select('id, author, content, parent_id, created_at, verified')
    .eq('article_slug', slug)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data.map(mapComment);
}

export async function listAllComments() {
  const { data, error } = await getSupabaseAdminClient()
    .from('community_comments')
    .select('article_slug, id, author, content, parent_id, created_at, verified')
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) throw error;
  return data.reduce((bySlug, row) => {
    (bySlug[row.article_slug] ||= []).push(mapComment(row));
    return bySlug;
  }, {});
}

export async function addComment(slug, comment) {
  if (comment.parentId) {
    const { data: parent, error: parentError } = await getSupabaseAdminClient()
      .from('community_comments')
      .select('id')
      .eq('id', comment.parentId)
      .eq('article_slug', slug)
      .maybeSingle();
    if (parentError) throw parentError;
    if (!parent) throw new Error('The comment being replied to was not found for this article.');
  }

  const { error } = await getSupabaseAdminClient()
    .from('community_comments')
    .insert({
      id: comment.id,
      article_slug: slug,
      author: comment.author,
      content: comment.content,
      parent_id: comment.parentId || null,
      created_at: comment.date,
      verified: comment.verified,
      ...(comment.ip ? { ip: comment.ip } : {}),
      ...(comment.ip_masked ? { ip_masked: comment.ip_masked } : {}),
      ...(comment.ip_hash ? { ip_hash: comment.ip_hash } : {}),
      ...(comment.country ? { country: comment.country } : {}),
      ...(comment.region ? { region: comment.region } : {}),
      ...(comment.city ? { city: comment.city } : {}),
      ...(comment.ua ? { ua: comment.ua } : {}),
    });
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
      verified: submission.verified,
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
      verified: message.verified,
    });
  if (error) throw error;
  return listChatMessages();
}
