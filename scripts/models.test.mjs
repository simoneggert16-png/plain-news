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

test('a model that times out is left behind, not asked three times', async () => {
  const { chat } = await freshModule('timeout');
  process.env.NVIDIA_API_KEY = 'test-key';
  const slow = 'deepseek-ai/deepseek-v4.1-flash';
  const fast = 'stepfun-ai/step-5-preview';
  const asked = [];
  globalThis.fetch = async (url, init) => {
    const model = JSON.parse(init.body).model;
    asked.push(model);
    if (model === slow) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ready' }, finish_reason: 'stop' }] }), { status: 200 });
  };

  // On 2026-10-31 the first model timed out three times in a row, the shift's
  // deadline ran out, and the preflight declared every model dead although
  // the second one answered in nine seconds.
  const answer = await chat('desk', [{ role: 'user', content: 'hi' }], { models: [slow, fast] });
  assert.equal(answer.model, fast);
  assert.deepEqual(asked, [slow, fast]);
});
