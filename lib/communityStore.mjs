import { getSupabaseAdminClient } from './supabase-admin.mjs';

function mapComment(row) {
  return {
    id: row.id,
    author: row.author,
    date: row.created_at,
    content: row.content,
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

export async function listComments(slug) {
  const { data, error } = await getSupabaseAdminClient()
    .from('community_comments')
    .select('id, author, content, created_at, verified')
    .eq('article_slug', slug)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data.map(mapComment);
}

export async function listAllComments() {
  const { data, error } = await getSupabaseAdminClient()
    .from('community_comments')
    .select('article_slug, id, author, content, created_at, verified')
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) throw error;
  return data.reduce((bySlug, row) => {
    (bySlug[row.article_slug] ||= []).push(mapComment(row));
    return bySlug;
  }, {});
}

export async function addComment(slug, comment) {
  const { error } = await getSupabaseAdminClient()
    .from('community_comments')
    .insert({
      id: comment.id,
      article_slug: slug,
      author: comment.author,
      content: comment.content,
      created_at: comment.date,
      verified: comment.verified,
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
