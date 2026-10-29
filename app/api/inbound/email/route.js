import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { recordInbound, findThreadBySender } from '@/lib/inboxStore.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Any inbound provider (Resend receiving, Cloudflare Email Routing worker,
// Postmark inbound, a script) posts here. The shared secret is the only gate:
// the desk address is public, so the endpoint must never be open.
function authorized(req) {
  const expected = process.env.INBOUND_SECRET;
  if (!expected) return false;
  const header = req.headers.get('x-inbound-secret') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(String(header || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const stripHtml = (html = '') =>
  String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const addressOf = (value) => {
  if (!value) return '';
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === 'string') return first;
  return first.address || first.email || first.value || '';
};

/** desk+<slug>@plain-news.ch, or any local part that is an existing slug. */
function slugFromRecipients(to) {
  const list = Array.isArray(to) ? to.map(addressOf).join(',') : String(addressOf(to) || to || '');
  const plus = list.match(/desk\+([a-z0-9][a-z0-9-]{5,120})@/i);
  return plus ? plus[1].toLowerCase() : null;
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: 'invalid json' }, { status: 400 });

  // Resend inbound wraps everything in {type, data}; generic providers post flat.
  const data = payload.data && (payload.type || '').startsWith('email') ? payload.data : payload;

  const from = addressOf(data.from || data.sender || data.envelope?.from).toLowerCase();
  const to = data.to || data.recipient || data.envelope?.to || '';
  const subject = data.subject || '';
  const text = data.text || data.plain || stripHtml(data.html || '');

  if (!from || !text) return NextResponse.json({ error: 'missing sender or body' }, { status: 400 });

  let slug = slugFromRecipients(to);
  if (!slug) {
    const thread = await findThreadBySender(from).catch(() => null);
    slug = thread?.slug || null;
  }

  try {
    const row = await recordInbound({
      slug,
      from,
      to: Array.isArray(to) ? to.map(addressOf).join(', ') : addressOf(to) || '',
      subject,
      text,
      messageId: data.message_id || data.messageId || data['message-id'] || null,
      inReplyTo: data.in_reply_to || data.inReplyTo || null,
    });
    return NextResponse.json({ ok: true, id: row.id, slug: row.slug });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST inbound mail here with x-inbound-secret' });
}
