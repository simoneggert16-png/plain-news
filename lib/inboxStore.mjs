// Inbound mail for the investigative desk.
//
// The desk writes to press offices and authorities under its own address; the
// replies arrive through the provider webhook (app/api/inbound/email) and land
// here. The bot reads them on its next run, extracts what was confirmed or
// denied, and drafts an answer — nothing is sent without approval.
import { getSupabaseAdminClient } from './supabase-admin.mjs';

const db = () => getSupabaseAdminClient();

const clean = (value, max) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .trim()
    .slice(0, max);

export async function recordInbound({ slug = null, from, to, subject, text, messageId, inReplyTo = null }) {
  const row = {
    slug: slug || null,
    direction: 'in',
    from_email: clean(from, 320),
    to_email: clean(to, 320),
    subject: clean(subject, 300),
    body: clean(text, 12000),
    message_id: clean(messageId, 400) || null,
    in_reply_to: clean(inReplyTo, 400) || null,
    status: 'new',
  };
  if (!row.from_email) throw new Error('inbound message without sender');
  const { data, error } = await db()
    .from('investigation_messages')
    .insert(row)
    .select('id, slug, from_email, subject, received_at')
    .single();
  if (error) throw error;
  return data;
}

export async function listMessages({ slug = null, status = null, limit = 40, direction = null } = {}) {
  let q = db()
    .from('investigation_messages')
    .select('id, slug, direction, from_email, to_email, subject, body, status, received_at, processed_at')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (slug) q = q.eq('slug', slug);
  if (status) q = q.eq('status', status);
  if (direction) q = q.eq('direction', direction);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function markMessages(ids, patch) {
  if (!ids?.length) return;
  const { error } = await db().from('investigation_messages').update(patch).in('id', ids);
  if (error) throw error;
}

/** Latest message that came from this address, for thread matching. */
export async function findThreadBySender(email) {
  const { data, error } = await db()
    .from('investigation_messages')
    .select('slug, message_id, subject, received_at')
    .eq('from_email', String(email || '').toLowerCase())
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
