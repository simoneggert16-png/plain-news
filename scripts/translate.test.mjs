import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../bots/lib/translate.mjs';

process.env.OLLAMA_API_KEY = 'test-key';
process.env.NVIDIA_API_KEY = 'test-key';

const MODEL = 'mistralai/mistral-large-4-1t-a52b';

const paragraph = (n) =>
  `Die Behörden in der Region haben den Bericht Nummer ${n} am Montag vorgestellt und die Zahlen für das Jahr bestätigt, und sie werden mit Spannung erwartet.`;

const source = {
  title: 'Banks in three countries hid the same fee',
  dek: 'The documents show one pattern across the border',
  facts: ['Fee of 1.2 percent', 'Three banks'],
  body: Array.from({ length: 6 }, (_, i) => `${paragraph(i + 1).replace('Die Behörden', 'The banks')} ${paragraph(i + 1)}`),
  context: '',
  imageCaption: '',
};

/** A stub that answers the head call and every paragraph chunk correctly. */
function stubFetch() {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    const messages = JSON.parse(init.body).messages;
    const asked = JSON.parse(messages[messages.length - 1].content);
    seen.push(asked);
    const answer = asked.paragraphs
      ? { body: asked.paragraphs.map((_, i) => paragraph(i + 1)) }
      : { title: 'Banken in drei Ländern versteckten denselben Zuschlag', dek: 'Die Dokumente zeigen ein Muster über die Grenze', facts: source.facts, context: '', imageCaption: '' };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) }, finish_reason: 'stop' }] }), { status: 200 });
  };
  return seen;
}

test('a long article is translated in small parts and keeps every paragraph', async () => {
  const seen = stubFetch();

  // On 2026-10-31 a whole 1.9 kB article did not finish in 240 s on any model,
  // although each of them answers a sentence in seconds. Small answers arrive.
  const out = await translate(source, 'de', [MODEL]);

  const heads = seen.filter((a) => !a.paragraphs);
  const chunks = seen.filter((a) => a.paragraphs);
  assert.equal(heads.length, 1, 'the headline is asked once');
  assert.ok(chunks.length >= 2, `the body was sent in ${chunks.length} part(s)`);
  assert.equal(chunks.flatMap((c) => c.paragraphs).length, source.body.length, 'paragraphs went missing on the way');
  for (const c of chunks) {
    const chars = c.paragraphs.join(' ').length;
    assert.ok(chars <= 1200, `one part carried ${chars} characters`);
  }
  assert.equal(out.body.length, source.body.length);
  assert.equal(out.body[0], paragraph(1));
  assert.match(out.title, /Banken/);
});

test('a part that returns the wrong number of paragraphs is refused, not stitched', async () => {
  let chunkCount = 0;
  globalThis.fetch = async (url, init) => {
    const messages = JSON.parse(init.body).messages;
    const asked = JSON.parse(messages[messages.length - 1].content);
    const answer = asked.paragraphs
      ? { body: (chunkCount++ === 0 ? asked.paragraphs.slice(1) : asked.paragraphs).map((_, i) => paragraph(i + 1)) }
      : { title: 'Banken in drei Ländern versteckten denselben Zuschlag', dek: 'Die Dokumente zeigen ein Muster über die Grenze', facts: source.facts, context: '', imageCaption: '' };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) }, finish_reason: 'stop' }] }), { status: 200 });
  };

  // A merged paragraph is information that went missing. Stitching it in
  // would publish an article that silently dropped a fact.
  await assert.rejects(() => translate(source, 'de', [MODEL]), /part 1\/\d+ returned \d+ of \d+ paragraphs/);
});
