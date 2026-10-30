// The desk's own mailbox.
//
// The letters leave as desk+<slug>@<domain>. The answers arrive in the same
// IMAP box, and nobody has to wire a provider webhook for them to show up:
// each shift the desk opens the box itself, files what came in against the
// dossier it belongs to and reads it.

import tls from 'node:tls';

const CRLF = '\r\n';

class Imap {
  constructor(socket, timeoutMs) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.buffer = Buffer.alloc(0);
    this.records = [];
    this.waiters = [];
    this.error = null;
    this.closed = false;

    socket.setTimeout(timeoutMs);
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parse();
      this.serve();
    });
    socket.on('error', (err) => { this.error = err; this.closed = true; this.serve(); });
    socket.on('end', () => { this.closed = true; this.serve(); });
    socket.on('timeout', () => { this.error = new Error('IMAP timeout'); socket.destroy(); });
  }

  // A response is a list of lines; a literal ("{1234}") turns into its own
  // record so that a mail body never gets mixed up with the protocol.
  parse() {
    for (;;) {
      const at = this.buffer.indexOf('\r\n');
      if (at < 0) break;
      const line = this.buffer.subarray(0, at).toString('utf8');
      const literal = line.match(/\{(\d+)\}$/);
      if (literal) {
        const size = Number(literal[1]);
        const start = at + 2;
        if (this.buffer.length < start + size) break;
        this.records.push({ type: 'literal', data: this.buffer.subarray(start, start + size) });
        this.buffer = this.buffer.subarray(start + size);
        continue;
      }
      this.buffer = this.buffer.subarray(at + 2);
      this.records.push({ type: 'line', text: line });
    }
  }

  serve() {
    while (this.waiters.length) {
      const waiter = this.waiters[0];
      if (this.error) {
        this.waiters.shift();
        waiter.reject(this.error);
        continue;
      }
      if (!this.records.length) break;
      this.waiters.shift();
      waiter.resolve(this.records.shift());
    }
    if (this.closed && this.waiters.length && !this.error) {
      const waiter = this.waiters.shift();
      waiter.reject(new Error('IMAP connection closed'));
    }
  }

  next() {
    if (this.error) return Promise.reject(this.error);
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      if (this.records.length) this.serve();
    });
  }

  async readLine() {
    for (;;) {
      const record = await this.next();
      if (record.type === 'line') return record.text;
    }
  }

  async send(tag, command) {
    this.socket.write(`${tag} ${command}${CRLF}`);
    return this.readUntil(tag);
  }

  // Collects everything until the tagged answer arrives.
  async readUntil(tag) {
    const lines = [];
    const literals = [];
    for (;;) {
      const record = await this.next();
      if (record.type === 'literal') { literals.push(record.data); continue; }
      const text = record.text;
      if (text.startsWith(`${tag} `)) {
        return { ok: /^${tag} OK/i.test(text), lines, literals, status: text };
      }
      lines.push(text);
    }
  }

  logout() {
    try { this.socket.write(`a999 LOGOUT${CRLF}`); } catch { /* the socket is going away anyway */ }
    this.socket.end();
  }
}

function connect({ host, port = 993, user, password, timeoutMs = 25000 }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => {
      const session = new Imap(socket, timeoutMs);
      session.greeting = session.readLine().catch(() => '* OK');
      resolve(session);
    });
    socket.once('error', reject);
    socket.once('timeout', () => { socket.destroy(new Error('IMAP connection timeout')); });
  });
}

function decodeQuotedPrintable(text) {
  return String(text)
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBase64(text) {
  return Buffer.from(String(text).replace(/\s+/g, ''), 'base64').toString('utf8');
}

function unfold(raw) {
  return raw.replace(/\r?\n[ \t]+/g, ' ');
}

function parseHeaders(raw) {
  const headers = {};
  for (const line of unfold(raw).split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (!(key in headers)) headers[key] = value;
  }
  return headers;
}

/**
 * Pulls the plain text out of a mail. Multipart replies carry the text in the
 * first text/plain part; quoted-printable and base64 are the usual encodings.
 */
function bodyText(headers, raw) {
  const type = String(headers['content-type'] || '');
  const encoding = String(headers['content-transfer-encoding'] || '').toLowerCase();

  let text = raw;
  const boundary = type.match(/boundary="?([^";]+)"?/i);
  if (boundary) {
    const parts = raw.split(new RegExp(`--${boundary[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(--)?\\r?\\n?`));
    const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p))
      || parts.find((p) => p.trim() && !/content-type:\s*text\/html/i.test(p))
      || '';
    text = plain.replace(/^[\s\S]*?\r?\n\r?\n/, '');
  } else if (/^text\/html/i.test(type) && !/multipart/i.test(type)) {
    text = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ');
  }

  if (encoding.includes('quoted-printable')) text = decodeQuotedPrintable(text);
  else if (encoding.includes('base64')) text = decodeBase64(text);

  return String(text).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

/** desk+<slug>@<domain> - the address tells the desk which dossier it is. */
export function slugFromAddress(address) {
  const match = String(address || '').match(/desk\+([a-z0-9][a-z0-9-]{5,120})@/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Opens the desk mailbox and returns what came in since the last shift.
 * `sinceUid` is the highest UID the desk has already filed; everything above
 * it is new.
 */
export async function fetchMail({ host, port = 993, user, password, sinceUid = 0, limit = 40, timeoutMs = 25000 } = {}) {
  if (!host || !user || !password) return { messages: [], lastUid: sinceUid };
  const session = await connect({ host, port, user, password, timeoutMs });
  const messages = [];
  let lastUid = sinceUid;

  try {
    const login = await session.send('a1', `LOGIN "${String(user).replace(/"/g, '')}" "${String(password).replace(/"/g, '')}"`);
    if (!login.ok) throw new Error(`IMAP login failed: ${login.status}`);

    const select = await session.send('a2', 'SELECT INBOX');
    if (!select.ok) throw new Error(`IMAP select failed: ${select.status}`);

    const search = await session.send('a3', sinceUid ? `UID SEARCH UID ${sinceUid + 1}:*` : 'UID SEARCH ALL');
    const uids = search.lines
      .filter((l) => l.startsWith('* SEARCH'))
      .flatMap((l) => l.split(/\s+/).slice(2))
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > sinceUid)
      .sort((a, b) => a - b)
      .slice(-limit);

    for (const uid of uids) {
      const fetched = await session.send('a4', `UID FETCH ${uid} (BODY.PEEK[])`);
      const raw = fetched.literals.map((l) => l.toString('utf8')).join('\n');
      if (!raw.trim()) continue;
      const split = raw.indexOf('\r\n\r\n');
      const head = split > 0 ? raw.slice(0, split) : raw;
      const body = split > 0 ? raw.slice(split + 4) : '';
      const headers = parseHeaders(head);
      messages.push({
        uid,
        from: String(headers.from || '').trim(),
        to: String(headers.to || '').trim(),
        subject: String(headers.subject || '').trim(),
        date: String(headers.date || '').trim(),
        messageId: String(headers['message-id'] || '').trim() || null,
        inReplyTo: String(headers['in-reply-to'] || '').trim() || null,
        text: bodyText(headers, body),
      });
      lastUid = Math.max(lastUid, uid);
    }
  } finally {
    session.logout();
  }

  return { messages, lastUid };
}
