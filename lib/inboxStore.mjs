// Inbound mail for the investigative desk.
//
// The desk writes to press offices and authorities under its own address; the
// replies arrive through the provider webhook (app/api/inbound/email) and land
// here. The bot reads them on its next run, extracts what was confirmed or
// denied, and drafts an answer — nothing is sent without approval.
//
// The desk keeps its own mailbox in the repository. The table in the database
// is the shared shelf where the editor sees the same letters. The desk's copy
// comes first and the shelf is only a mirror of it: an answer from an
// authority is never lost because a migration is still waiting or because the
// database is down for an hour.
import fs from 'node:fs';
import path from 'node:path';
import { getSupabaseAdminClient } from './supabase-admin.mjs';

const db = () => getSupabaseAdminClient();

const INBOX_FILE = path.join(process.cwd(), 'content', 'investigations', 'inbox.json');
// The desk reads 4000 characters of a letter into the model; the file keeps
// what the desk can actually use.
const FILE_BODY_LIMIT = 4000;
const FILE_MESSAGES = 300;

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
  fs.writeFileSync(INBOX_FILE, `${JSON.stringify(rows.slice(-FILE_MESSAGES), null, 2)}\n`);
}

const clean = (value, max) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .trim()
    .slice(0, max);

/** Two copies of the same letter — the desk's and the shelf's — are one letter. */
function mailKey(row) {
  const id = String(row.message_id || '').trim();
  if (id) return `mid:${id.toLowerCase()}`;
  return `mix:${String(row.from_email || '').toLowerCase()}|${String(row.subject || '')}|${String(row.received_at || '')}`;
}

export async function recordInbound({ slug = null, from, to, subject, text, messageId, inReplyTo = null }) {
  const receivedAt = new Date().toISOString();
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
    received_at: receivedAt,
  };
  if (!row.from_email) throw new Error('inbound message without sender');

  // The desk files the letter in its own mailbox first. Everything after this
  // is a mirror and may fail without the letter being lost.
  const rows = readMailboxFile();
  const filed = {
    ...row,
    body: clean(row.body, FILE_BODY_LIMIT),
    id: `F${rows.length + 1}`,
    processed_at: null,
  };
  rows.push(filed);
  writeMailboxFile(rows);

  try {
    const { data, error } = await db()
      .from('investigation_messages')
      .insert(row)
      .select('id, slug, from_email, subject, received_at')
      .single();
    if (error) throw error;
    filed.db_id = data?.id ?? null;
    writeMailboxFile(readMailboxFile().map((r) => (r.id === filed.id ? { ...r, db_id: filed.db_id } : r)));
    return { ...filed, db_id: filed.db_id };
  } catch (err) {
    // The shelf does not answer. The letter is already in the desk's mailbox.
    return filed;
  }
}

/**
 * The desk's letters and the shelf's letters, one list. A letter that only
 * one of them knows is still a letter the desk has to read.
 */
function mergeMailboxes(shelf, desk) {
  const byKey = new Map();
  for (const row of desk) byKey.set(mailKey(row), { ...row });
  for (const row of shelf) {
    const key = mailKey(row);
    const mine = byKey.get(key);
    if (!mine) {
      byKey.set(key, { ...row });
      continue;
    }
    // The desk's copy is the one that says whether the letter was read; the
    // shelf only adds its own id.
    if (mine.db_id == null && row.id != null) mine.db_id = row.id;
    if (!mine.body && row.body) mine.body = row.body;
    if (!mine.received_at && row.received_at) mine.received_at = row.received_at;
  }
  return [...byKey.values()].sort((a, b) =>
    String(b.received_at || '').localeCompare(String(a.received_at || ''))
  );
}

export async function listMessages({ slug = null, status = null, limit = 40, direction = null } = {}) {
  const shelf = await (async () => {
    try {
      const { data, error } = await db()
        .from('investigation_messages')
        .select('id, slug, direction, from_email, to_email, subject, body, status, received_at, processed_at')
        .order('received_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  })();

  const desk = readMailboxFile();
  const rows = mergeMailboxes(shelf, desk)
    .filter((r) => (slug ? r.slug === slug : true))
    .filter((r) => (status ? r.status === status : true))
    .filter((r) => (direction ? r.direction === direction : true));
  return rows.slice(0, limit);
}

export async function markMessages(ids, patch) {
  if (!ids?.length) return;
  const wanted = ids.map((id) => String(id));

  // The desk's own copy: a letter the desk has read stays read.
  const rows = readMailboxFile();
  let touched = false;
  for (const row of rows) {
    if (!wanted.includes(String(row.id)) && !wanted.includes(String(row.db_id))) continue;
    Object.assign(row, patch);
    touched = true;
  }
  if (touched) writeMailboxFile(rows);

  // The shelf: the same letters, with the ids it knows them by.
  const shelfIds = rows.filter((r) => wanted.includes(String(r.id)) || wanted.includes(String(r.db_id)))
    .map((r) => r.db_id)
    .filter((id) => id != null);
  const all = [...new Set([...wanted, ...shelfIds])].filter((id) => /^\d+$/.test(id));
  if (!all.length) return;
  try {
    const { error } = await db().from('investigation_messages').update(patch).in('id', all);
    if (error) throw error;
  } catch {
    /* the shelf is down; the desk's copy is marked */
  }
}

/** Latest message that came from this address, for thread matching. */
export async function findThreadBySender(email) {
  const wanted = String(email || '').toLowerCase();
  const shelf = await (async () => {
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
      return null;
    }
  })();
  const desk = readMailboxFile()
    .filter((r) => String(r.from_email || '').toLowerCase() === wanted)
    .sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || '')));
  const newest = [...(desk.length ? [desk[0]] : []), ...(shelf ? [shelf] : [])].sort(
    (a, b) => String(b.received_at || '').localeCompare(String(a.received_at || ''))
  );
  if (!newest.length) return null;
  const row = newest[0];
  return { slug: row.slug, message_id: row.message_id, subject: row.subject, received_at: row.received_at };
}
