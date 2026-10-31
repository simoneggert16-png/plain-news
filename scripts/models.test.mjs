import test from 'node:test';
import assert from 'node:assert/strict';

process.env.OLLAMA_API_KEY = 'test-key';
delete process.env.NVIDIA_API_KEY;

const quotaBody = (kind) => JSON.stringify({
  error: kind === 'monthly'
    ? 'you (somebody) have reached your monthly usage limit, upgrade for higher limits'
    : 'too many requests',
});

async function freshModule(tag) {
  return import(`../bots/lib/llm.mjs?${tag}`);
}

test('a monthly quota answer parks the model instead of asking again in ten minutes', async () => {
  const { chat } = await freshModule('monthly');
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(quotaBody('monthly'), { status: 429 });
  };

  await assert.rejects(() => chat('desk', [{ role: 'user', content: 'hi' }], { models: ['ollama/gpt-oss:120b'] }));

  // The real shift paid this round trip on every step of every dossier.
  // The model is out for hours now: a second call must not reach the network.
  const started = Date.now();
  await assert.rejects(() => chat('desk', [{ role: 'user', content: 'hi' }], { models: ['ollama/gpt-oss:120b'] }));
  assert.equal(calls, 1, 'the parked model was asked again');
  assert.ok(Date.now() - started < 500);
});

test('a plain rate limit is still retried after ten minutes, not parked for the month', async () => {
  const { chat } = await freshModule('ratelimit');
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(quotaBody('rate'), { status: 429 });
  };

  await assert.rejects(() => chat('desk', [{ role: 'user', content: 'hi' }], { models: ['ollama/gpt-oss:20b'] }));
  assert.equal(calls, 1);
});

test('a chain in which every model is parked fails fast and says so', async () => {
  const { chat } = await freshModule('allparked');
  globalThis.fetch = async () => new Response(quotaBody('monthly'), { status: 429 });
  const models = ['ollama/gpt-oss:120b', 'ollama/gemma4:31b'];

  await assert.rejects(() => chat('desk', [{ role: 'user', content: 'hi' }], { models }), /no usable model|429/);
  const started = Date.now();
  await assert.rejects(() => chat('desk', [{ role: 'user', content: 'hi' }], { models }), /no usable model/);
  assert.ok(Date.now() - started < 500);
});
