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

const head = { title: 'Banken in drei Ländern versteckten denselben Zuschlag', dek: 'Die Dokumente zeigen ein Muster über die Grenze', facts: source.facts, context: '', imageCaption: '' };

/** A stub that answers correctly and records what it was asked. */
function stubFetch(render = (asked) => (asked.paragraphs ? { body: asked.paragraphs.map((_, i) => paragraph(i + 1)) } : head)) {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    const messages = JSON.parse(init.body).messages;
    const asked = JSON.parse(messages[messages.length - 1].content);
    seen.push(asked);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(render(asked)) }, finish_reason: 'stop' }] }), { status: 200 });
  };
  return seen;
}

test('the whole body goes out as one answer and keeps every paragraph', async () => {
  delete process.env.TRANSLATE_WHOLE_BODY_CHARS;
  const seen = stubFetch();

  // Every call cost 65-100 s of queue time on 2026-10-31, so four chunks meant
  // seven minutes per language for one article. One body answer is one wait.
  const out = await translate(source, 'de', [MODEL]);

  assert.equal(seen.filter((a) => !a.paragraphs).length, 1, 'the headline is asked once');
  const bodies = seen.filter((a) => a.paragraphs);
  assert.equal(bodies.length, 1, 'the body is asked once');
  assert.equal(bodies[0].paragraphs.length, source.body.length);
  assert.equal(out.body.length, source.body.length);
  assert.equal(out.body[0], paragraph(1));
  assert.match(out.title, /Banken/);
});

test('a body too long for one answer is split into parts', async () => {
  process.env.TRANSLATE_WHOLE_BODY_CHARS = '700';
  const seen = stubFetch();
  try {
    const out = await translate(source, 'de', [MODEL]);
    const chunks = seen.filter((a) => a.paragraphs);
    assert.ok(chunks.length >= 2, `the body was sent in ${chunks.length} part(s)`);
    assert.equal(chunks.flatMap((c) => c.paragraphs).length, source.body.length, 'paragraphs went missing on the way');
    assert.equal(out.body.length, source.body.length);
  } finally {
    delete process.env.TRANSLATE_WHOLE_BODY_CHARS;
  }
});

test('an answer that merged paragraphs is split again, not published', async () => {
  delete process.env.TRANSLATE_WHOLE_BODY_CHARS;
  let wholeAsked = 0;
  const seen = stubFetch((asked) => {
    if (!asked.paragraphs) return head;
    if (asked.paragraphs.length === source.body.length) {
      // The model answered the whole body with one paragraph fewer.
      wholeAsked++;
      return { body: asked.paragraphs.slice(1).map((_, i) => paragraph(i + 1)) };
    }
    return { body: asked.paragraphs.map((_, i) => paragraph(i + 1)) };
  });

  const out = await translate(source, 'de', [MODEL]);

  assert.equal(wholeAsked, 1);
  assert.ok(seen.filter((a) => a.paragraphs && a.paragraphs.length < source.body.length).length >= 1, 'the text was split');
  assert.equal(out.body.length, source.body.length);
});

test('a part that returns the wrong number of paragraphs is refused, not stitched', async () => {
  process.env.TRANSLATE_WHOLE_BODY_CHARS = '700';
  let chunkCount = 0;
  stubFetch((asked) => {
    if (!asked.paragraphs) return head;
    return { body: (chunkCount++ === 0 ? asked.paragraphs.slice(1) : asked.paragraphs).map((_, i) => paragraph(i + 1)) };
  });

  // A merged paragraph is information that went missing. Stitching it in
  // would publish an article that silently dropped a fact.
  try {
    await assert.rejects(() => translate(source, 'de', [MODEL]), /part 1\/\d+ returned \d+ of \d+ paragraphs/);
  } finally {
    delete process.env.TRANSLATE_WHOLE_BODY_CHARS;
  }
});
