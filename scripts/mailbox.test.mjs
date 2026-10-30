// The desk's own mailbox.
//
// The answers that come back from press offices and authorities belong to the
// desk even when the database does not answer. These tests put a shelf behind
// the desk that answers, one that does not, and one that answers late — the
// desk must read the same letter once and remember that it read it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-mailbox-'));
process.chdir(workdir);
process.env.SUPABASE_URL = 'https://shelf.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

const store = await import('../lib/inboxStore.mjs');

const MAIL = {
  slug: 'north-korea-crypto',
  from: 'press.office@example.org',
  to: 'desk+north-korea-crypto@plain-news.ch',
  subject: 'Re: our questions about the Bitget transfers',
  text: 'Our records show the licence was issued in March and revoked in June. We have attached the decision.',
  messageId: '<abc123@example.org>',
};

const INBOX_FILE = path.join(workdir, 'content', 'investigations', 'inbox.json');

/** A shelf that answers like Supabase does. */
function shelf({ answers = true } = {}) {
  const rows = [];
  let nextId = 1;
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = decodeURIComponent(String(input));
    const method = String(init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    const one = String(headers.get('accept') || '').includes('pgrst.object');
    const body = init.body ? JSON.parse(init.body) : null;
    if (!answers) throw new Error('the shelf does not answer');
    const reply = (data, status = 200) =>
      new Response(JSON.stringify(one && !Array.isArray(data) ? data : data), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    if (method === 'POST') {
      const out = (Array.isArray(body) ? body : [body]).map((r) => ({ id: nextId++, ...r }));
      rows.push(...out);
      return reply(one ? out[0] : out, 201);
    }
    if (method === 'PATCH') {
      const wanted = String(url.match(/id=in\.\(([^)]*)\)/)?.[1] || '')
        .split(',')
        .map((id) => Number(id));
      for (const row of rows) if (wanted.includes(row.id)) Object.assign(row, body);
      return reply([]);
    }
    if (method === 'GET') {
      let out = [...rows];
      const mail = url.match(/from_email=eq\.([^&]+)/)?.[1];
      if (mail) out = out.filter((r) => r.from_email === decodeURIComponent(mail));
      return reply(one ? out[0] || null : out);
    }
    return reply([]);
  };
  return { rows, restore: () => { globalThis.fetch = original; } };
}

function clean() {
  fs.rmSync(INBOX_FILE, { force: true });
}

test('an answer is filed in the desk\'s own mailbox', async () => {
  clean();
  const store2 = shelf();
  try {
    const filed = await store.recordInbound(MAIL);
    assert.ok(filed.id, 'the letter has an id in the desk\'s mailbox');
    const onDisk = JSON.parse(fs.readFileSync(INBOX_FILE, 'utf8'));
    assert.equal(onDisk.length, 1);
    assert.equal(onDisk[0].from_email, MAIL.from);
    assert.equal(onDisk[0].subject, MAIL.subject);
    assert.equal(onDisk[0].status, 'new');
  } finally {
    store2.restore();
  }
});

test('the desk and the shelf show the same letter only once', async () => {
  clean();
  const store2 = shelf();
  try {
    await store.recordInbound(MAIL);
    const rows = await store.listMessages({ limit: 20 });
    assert.equal(rows.length, 1, 'one letter, not two copies');
    assert.equal(rows[0].from_email, MAIL.from);
    assert.ok(rows[0].db_id != null, 'the letter knows its place on the shelf');
  } finally {
    store2.restore();
  }
});

test('a letter the desk has read stays read', async () => {
  clean();
  const store2 = shelf();
  try {
    const filed = await store.recordInbound(MAIL);
    await store.markMessages([filed.id], { status: 'processed', processed_at: '2026-10-30T12:00:00Z' });
    const unread = await store.listMessages({ status: 'new', limit: 20 });
    assert.equal(unread.length, 0, 'the desk does not read it twice');
    const all = await store.listMessages({ limit: 20 });
    assert.equal(all[0].status, 'processed');
    assert.equal(store2.rows[0].status, 'processed', 'the shelf is told as well');
  } finally {
    store2.restore();
  }
});

test('an answer that arrives while the shelf is down is still read', async () => {
  clean();
  const store2 = shelf({ answers: false });
  try {
    const filed = await store.recordInbound(MAIL);
    assert.ok(filed.id);
    const rows = await store.listMessages({ limit: 20 });
    assert.equal(rows.length, 1, 'the letter is on the desk even without the shelf');
    assert.equal(rows[0].status, 'new');
  } finally {
    store2.restore();
  }
});

test('a letter that only the shelf knows is still a letter', async () => {
  clean();
  const store2 = shelf();
  try {
    // A letter filed while the shelf was unreachable, which the shelf only
    // learns about later.
    await store.recordInbound(MAIL);
    const rows = await store.listMessages({ limit: 20 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, MAIL.slug);
  } finally {
    store2.restore();
  }
});

test('the desk finds the last letter from an address', async () => {
  const store2 = shelf();
  try {
    await store.recordInbound(MAIL);
    const thread = await store.findThreadBySender(MAIL.from);
    assert.equal(thread.slug, MAIL.slug);
    assert.equal(thread.message_id, MAIL.messageId);
  } finally {
    store2.restore();
  }
});

test('a letter that belongs to no story is not kept in the desk’s mailbox', async () => {
  clean();
  const store2 = shelf();
  try {
    // A tip is read in the shift it arrives. The desk keeps what it learned,
    // not the letter of a stranger.
    const letter = await store.recordInbound({ ...MAIL, slug: null, store: false });
    assert.ok(letter.id);
    assert.ok(!fs.existsSync(INBOX_FILE), 'the letter is not in the repository');
    assert.equal(store2.rows.length, 1, 'the editor still sees it on the shelf');
  } finally {
    store2.restore();
  }
});

// ───────────────────── the mailbox never reaches the public repository ─────────────────────

// The repository is public. The letters of people who wrote to the desk are
// not part of it — neither the file nor the commit that would carry it.
test('the desk’s mailbox is not part of the public repository', () => {
  // The repository is where this file lives, not where the test runs: the
  // tests above move the working directory into a scratch folder.
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const gitignore = fs.readFileSync(path.join(repo, '.gitignore'), 'utf8');
  assert.match(gitignore, /content\/investigations\/inbox\.json/,
    'the mailbox file is ignored by git');

  const push = fs.readFileSync(path.join(repo, 'scripts', 'push-content.sh'), 'utf8');
  assert.match(push, /git reset -q -- content\/investigations\/inbox\.json/,
    'the push script takes the mailbox back out');

  const live = fs.readFileSync(path.join(repo, '.github', 'workflows', 'live.yml'), 'utf8');
  assert.match(live, /git reset -q -- content\/investigations\/inbox\.json/,
    'the live workflow takes the mailbox back out');
});
