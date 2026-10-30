// The right of reply must never carry an answer nobody gave. These are the
// sentences that have slipped into drafts, and the ones that must not.

import assert from 'node:assert/strict';
import { applyRightOfReply, INVENTED_REPLY, rightOfReplyLog, rightOfReplyProse } from '../bots/lib/rightOfReply.mjs';

const nothing = [];
const oneRequest = [
  { org: 'Bitget', to_email: 'press@bitget.com', status: 'sent', sent_at: '2026-10-28T09:00:00Z' },
];
const oneReply = [
  { org: 'Chainalysis', to_email: 'press@chainalysis.com', status: 'replied', sent_at: '2026-10-28T09:00:00Z', reply_note: 'We shared the wallet addresses with law enforcement.' },
];

// Nothing sent: the text says so, and says nothing else.
const empty = rightOfReplyProse(nothing);
assert.match(empty, /has not sent any questions/);
assert.match(empty, /still outstanding/);
assert.ok(!INVENTED_REPLY.test(empty), 'the desk text must not trip its own check');
assert.equal(rightOfReplyLog(nothing), '- We have not sent any request yet. Our questions are still outstanding.');

// A request on file: the date and the answer come from the log.
const sent = rightOfReplyProse(oneRequest);
assert.match(sent, /Bitget has not answered our questions/);
assert.match(sent, /2026-10-28/);

const replied = rightOfReplyProse(oneReply);
assert.match(replied, /Chainalysis answered on 2026-10-28/);
assert.match(replied, /law enforcement/);

// The field belongs to the desk, not to the model.
const draft = { rightOfReply: 'Binance answered on 2 November 2026.' };
applyRightOfReply(draft, nothing);
assert.match(draft.rightOfReply, /has not sent any questions/);
assert.ok(!draft.rightOfReply.includes('Binance answered'));

// The sentences that have slipped into drafts before.
const invented = [
  'Binance answered on 2 November 2026, reiterating that it will cover all losses.',
  'Bitget replied on 3 November 2026, confirming that the software bug has been patched.',
  'The agency declined to comment on the incident.',
  'The agency did not comment when contacted on 5 November 2026.',
  'No comment was made.',
  'Chainalysis confirmed the accuracy of our figures.',
  'They replied to our questions in full.',
  'When we wrote to the ministry, it answered within a week.',
  'Our questions were answered on 4 October.',
  'The press office did not reply to our request.',
  'The exchange has not answered our questions.',
];
for (const sentence of invented) {
  assert.ok(INVENTED_REPLY.test(sentence), `must be caught: ${sentence}`);
}

// Sentences that only look similar and must not be caught.
const innocent = [
  'The hackers responded to the phishing lure within hours.',
  'The bank replied to the regulator in March 2026.',
  'Regulators answered the market questions of 2025.',
  'She confirmed the accuracy of the ledger.',
  'When the delegation asked about the budget, the minister answered.',
  'Nobody has yet answered the question of who paid.',
];
for (const sentence of innocent) {
  assert.ok(!INVENTED_REPLY.test(sentence), `must not be caught: ${sentence}`);
}

console.log('right of reply: all checks passed');
