// Inbound mail for the investigative desk.
//
// The desk writes to press offices and authorities under its own address; the
// replies arrive through the provider webhook (app/api/inbound/email) and land
// here. The bot reads them on its next run, extracts what was confirmed or
// denied, and drafts an answer — nothing is sent without approval.
//
// The table in the database is the shared shelf. While it does not answer, the
// desk keeps its mailbox in the repository, so an answer from an authority is
// never lost because a migration is still waiting.
import fs from 'node:fs';
import path from 'node:path';
import { getSupabaseAdminClient } from './supabase-admin.mjs';

const db = () => getSupabaseAdminClient();

const INBOX_FILE = path.join(process.cwd(), 'content', 'investigations', 'inbox.json');

function readMailboxFile() {
  try {
    if (!fs.existsSync(INBOX_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(INBOX_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeMailboxFile(rows) {
  fs.mkdirSync(path.dirname(INBOX_FILE), { recursive: true });
  fs.writeFileSync(INBOX_FILE, `${JSON.stringify(rows.slice(-300), null, 2)}\n`);
}

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
    from_email: clean(from, 320).toLowerCase(),
    to_email: clean(to, 320),
    subject: clean(subject, 300),
    body: clean(text, 12000),
    message_id: clean(messageId, 400) || null,
    in_reply_to: clean(inReplyTo, 400) || null,
    status: 'new',
  };
  if (!row.from_email) throw new Error('inbound message without sender');
  try {
    const { data, error } = await db()
      .from('investigation_messages')
      .insert(row)
      .select('id, slug, from_email, subject, received_at')
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    // The shelf does not answer. The desk files the letter in its own
    // repository, so the answer survives until the table is there.
    try {
      const rows = readMailboxFile();
      const filed = {
        ...row,
        id: `F${rows.length + 1}`,
        received_at: new Date().toISOString(),
        processed_at: null,
      };
      rows.push(filed);
      writeMailboxFile(rows);
      return filed;
    } catch (fileErr) {
      throw new Error(`${err.message} (${fileErr.message})`);
    }
  }
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
  if (error) {
    const rows = readMailboxFile()
      .filter((r) => (slug ? r.slug === slug : true))
      .filter((r) => (status ? r.status === status : true))
      .filter((r) => (direction ? r.direction === direction : true))
      .sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || '')))
      .slice(0, limit);
    return rows;
  }
  return data;
}

export async function markMessages(ids, patch) {
  if (!ids?.length) return;
  const wanted = ids.map((id) => String(id));
  try {
    const { error } = await db().from('investigation_messages').update(patch).in('id', ids);
    if (error) throw error;
  } catch {
    const rows = readMailboxFile();
    let touched = false;
    for (const row of rows) {
      if (!wanted.includes(String(row.id))) continue;
      Object.assign(row, patch);
      touched = true;
    }
    if (touched) writeMailboxFile(rows);
  }
}

/** Latest message that came from this address, for thread matching. */
export async function findThreadBySender(email) {
  const wanted = String(email || '').toLowerCase();
  try {
    const { data, error } = await db()
      .from('investigation_messages')
      .select('slug, message_id, subject, received_at')
      .eq('from_email', wanted)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch {
    const rows = readMailboxFile()
      .filter((r) => String(r.from_email || '').toLowerCase() === wanted)
      .sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || '')));
    if (!rows.length) return null;
    const row = rows[0];
    return { slug: row.slug, message_id: row.message_id, subject: row.subject, received_at: row.received_at };
  }
}
