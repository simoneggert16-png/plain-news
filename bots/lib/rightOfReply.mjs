// The right of reply.
//
// A draft that reports an answer nobody gave is the worst error a newsroom
// can make. If no letter went out, no reply can be reported - and the text
// that says so is the desk's own, not the model's.

const day = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'an unknown date';
};

/** The requests on file: who we asked, when, and what came back. */
export function askedRequests(outreach) {
  return (outreach || []).filter((o) => ['sent', 'replied'].includes(o.status));
}

/** What the right-of-reply log holds, for the prompt. */
export function rightOfReplyLog(outreach) {
  const asked = askedRequests(outreach);
  if (!asked.length) return '- We have not sent any request yet. Our questions are still outstanding.';
  return asked
    .map((o) => `- ${o.org || o.to_email}: asked ${day(o.sent_at || o.approved_at || o.created_at)}, ${o.status === 'replied' ? `answered: ${o.reply_note || '(reply without note)'}` : 'no answer yet'}`)
    .join('\n');
}

/** The passage that goes into the article. */
export function rightOfReplyProse(outreach) {
  const asked = askedRequests(outreach);
  if (!asked.length) {
    return 'PLAIN. has not sent any questions to the organisations named in this report. Our questions are still outstanding. When the answers arrive, we will publish them in full or in summary, as the sender chooses, and this passage will be updated as soon as anything changes.';
  }
  const lines = asked.map((o) => {
    const who = o.org || o.to_email;
    const when = day(o.sent_at || o.approved_at || o.created_at);
    if (o.status === 'replied') return `${who} answered on ${when}: ${o.reply_note || 'the reply is on file'}`;
    return `${who} has not answered our questions, which we sent on ${when}.`;
  });
  return `We put our questions to the organisations named in this report. ${lines.join(' ')}`;
}

/** Puts the desk's own right of reply into the draft. */
export function applyRightOfReply(draft, outreach) {
  if (!draft || typeof draft !== 'object') return draft;
  draft.rightOfReply = rightOfReplyProse(outreach);
  return draft;
}

/**
 * What in the body would be an invented answer. The right-of-reply field is
 * the desk's own text now; what can still go wrong is a sentence in the
 * article about our own correspondence.
 */
export const INVENTED_REPLY = new RegExp([
  String.raw`\b(?:replied|responded|answered)\s+(?:on\s+\d{1,2}\s+\w+\s+\d{4}|to\s+(?:us|our\b))`,
  String.raw`\bdeclined\s+to\s+(?:comment|disclose|answer|respond)`,
  String.raw`\bno\s+comment\b`,
  String.raw`\bconfirmed\s+the\s+accuracy\s+(?:of\s+our|to\s+us|with\s+us)\b`,
  String.raw`\bwhen\s+(?:we|our\s+desk|the\s+desk)?\s*(?:asked|contacted|wrote|queried|approached)\b`,
  String.raw`\bour\s+(?:questions?|letters?|requests?)\s+(?:were|was|have\s+been)\s+(?:answered|ignored|declined|unanswered)`,
  String.raw`\bdid\s+not\s+(?:reply|respond|answer|comment)\s+(?:on|to)\s+(?:our|us)`,
  String.raw`\b(?:has|have|had)\s+not\s+(?:replied|responded|answered|commented)\b`,
].join('|'), 'i');
