// What a shift must never lose again.
//
// Three failures cost the desk a whole day each: a reply that carried its
// arguments next to a flag was read as no call at all, a model whose quota
// was used up was retried until the shift ran out, and a document the desk
// had read was thrown away because its headline did not repeat the story.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.OLLAMA_API_KEY ||= 'test-key';
process.env.NVIDIA_API_KEY ||= 'test-key';

const { runAgent } = await import('../bots/lib/agent.mjs');
const llm = await import('../bots/lib/llm.mjs');

// ───────────────────────── the agent reads the reply ─────────────────────────

const TOOLS = [
  { name: 'search', args: '{"query": string}', description: 'Search.', run: async (a) => ({ args: a }) },
  { name: 'open', args: '{"url": string}', description: 'Open.', run: async (a) => ({ args: a }) },
  { name: 'save_claim', args: '{"text": string, "sources": ["S1"], "contested": boolean?}', description: 'File.', run: async (a) => ({ args: a }) },
];

async function firstCall(reply) {
  const calls = [];
  await runAgent({
    role: 'desk',
    system: 'test',
    task: 'test',
    tools: TOOLS.map((t) => ({ ...t, run: async (a) => { calls.push({ tool: t.name, args: a }); return { ok: true }; } })),
    maxSteps: 1,
    ask: async () => ({ data: reply, text: JSON.stringify(reply) }),
    log: () => {},
  });
  return calls[0] || null;
}

test('a flag next to the arguments is still a call', async () => {
  const call = await firstCall({ query: 'Call of Duty publisher apologizes for Itaewon crowd crush footage', open: true });
  assert.equal(call?.tool, 'search');
  assert.equal(call.args.open, undefined, 'the flag must not be passed as an argument');
  assert.match(call.args.query, /Itaewon/);
});

test('an explicit action, a tool name and a bare link all work', async () => {
  assert.equal((await firstCall({ action: 'open', url: 'https://example.org/a' }))?.tool, 'open');
  assert.equal((await firstCall({ tool: 'search', query: 'activision blizzard itaewon' }))?.tool, 'search');
  assert.equal((await firstCall('https://example.org/b'))?.tool, 'open');
});

test('a flag the tool documents is kept', async () => {
  const call = await firstCall({ action: 'save_claim', text: 'The publisher used the footage without asking.', sources: ['S1'], contested: false });
  assert.equal(call?.tool, 'save_claim');
  assert.equal(call.args.contested, false);
});

test('a reply with nothing to do calls no tool', async () => {
  assert.equal(await firstCall({ thought: 'I have nothing to do here.' }), null);
});

// ───────────────────────── the desk keeps what it read ─────────────────────────

const SOURCE = fs.readFileSync(new URL('../bots/investigate.mjs', import.meta.url), 'utf8');

// The dossier file is a script, not a library: the function is taken out of
// it as it stands, so the test cannot drift away from the code.
function take(name) {
  const at = SOURCE.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} not found`);
  let depth = 0;
  let opened = false;
  for (let i = at; i < SOURCE.length; i++) {
    if (SOURCE[i] === '{') { depth++; opened = true; }
    else if (SOURCE[i] === '}' && --depth === 0 && opened) return SOURCE.slice(at, i + 1);
  }
  throw new Error(`${name} unterminated`);
}

const prune = new Function(`
  const STOPWORDS = new Set(${JSON.stringify([...new Set(SOURCE.match(/const STOPWORDS = new Set\(\[([\s\S]*?)\]\);/)[1].match(/'([^']+)'/g).map((w) => w.slice(1, -1)))])});
  const MONTHS = new Set(${JSON.stringify([...new Set(SOURCE.match(/const MONTHS = new Set\(\[([\s\S]*?)\]\);/)[1].match(/'([^']+)'/g).map((w) => w.slice(1, -1)))])});
  const FILLER = new Set(${JSON.stringify([...new Set(SOURCE.match(/const FILLER = new Set\(\[([\s\S]*?)\]\);/)[1].match(/'([^']+)'/g).map((w) => w.slice(1, -1)))])});
  const GENERIC = new Set(${JSON.stringify([...new Set(SOURCE.match(/const GENERIC = new Set\(\[([\s\S]*?)\]\);/)[1].match(/'([^']+)'/g).map((w) => w.slice(1, -1)))])});
  const NOT_A_SOURCE_HOSTS = new Set(${JSON.stringify([...new Set(SOURCE.match(/const NOT_A_SOURCE_HOSTS = new Set\(\[([\s\S]*?)\]\);/)[1].match(/'([^']+)'/g).map((w) => w.slice(1, -1)))])});
  const notASource = ${take('notASource')};
  const urlKey = ${take('urlKey')};
  const hostOf = ${take('hostOf')};
  const log = () => {};
  return ${take('pruneOffTopic')};
`)();

const STORY = {
  title: 'Call of Duty uses Seoul crowd crush footage',
  angle: 'Did the US game developer exploit a tragedy for profit?',
  brief: { centre: 'South Korea', beat: 'Activision Blizzard' },
  queries: ['Activision Blizzard Itaewon crowd crush apology'],
};

test('a document the desk read survives, even under a bland headline', () => {
  const d = {
    ...STORY,
    claims: [],
    sources: [
      { id: 'S1', url: 'https://example.org/a', outlet: 'Example', title: 'Statement', text: 'The video was recorded during the Itaewon crowd crush in Seoul.' },
    ],
  };
  prune(d);
  assert.equal(d.sources.length, 1);
});

test('a headline about something else does not stay', () => {
  const d = {
    ...STORY,
    claims: [],
    sources: [
      { id: 'S1', url: 'https://www.abc.net.au/news/2', outlet: 'ABC Australia', title: 'Unrelated fishing report', text: null },
    ],
  };
  prune(d);
  assert.equal(d.sources.length, 0);
});

test('a document about something else does not stay, even when it was read', () => {
  const d = {
    ...STORY,
    claims: [],
    sources: [
      { id: 'S1', url: 'https://example.org/b', outlet: 'Example', title: 'Unrelated fishing report', text: 'The council met about the harbour and the new quota for sardines.' },
    ],
  };
  prune(d);
  assert.equal(d.sources.length, 0);
});

test('a claim keeps its source alive', () => {
  const d = {
    ...STORY,
    claims: [{ id: 'C1', text: 'The publisher used the footage without asking.', sources: ['S1'] }],
    sources: [
      { id: 'S1', url: 'https://example.org/c', outlet: 'Example', title: 'Statement', text: 'No relevant words here at all.' },
    ],
  };
  prune(d);
  assert.equal(d.sources.length, 1);
});

test('an encyclopedia and a second copy of a document are not sources', () => {
  const d = {
    ...STORY,
    claims: [],
    sources: [
      { id: 'S1', url: 'https://en.wikipedia.org/wiki/Call_of_Duty', outlet: 'Wikipedia', title: 'Call of Duty crowd crush', text: null },
      { id: 'S2', url: 'https://example.org/d', outlet: 'Example', title: 'Call of Duty publisher apologizes', text: null },
      { id: 'S3', url: 'https://example.org/d/', outlet: 'Example', title: 'Call of Duty publisher apologizes', text: null },
    ],
  };
  prune(d);
  assert.equal(d.sources.length, 1);
  assert.equal(d.sources[0].url, 'https://example.org/d');
});

// ───────────────────────── a spent quota is a spent quota ─────────────────────────

test('a model whose quota is used up is not tried again', async () => {
  const original = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : {};
    asked.push(String(body.model || url));
    if (String(url).includes('api.ollama.com')) {
      return new Response(JSON.stringify({ error: 'monthly usage limit' }), { status: 429 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
  };
  try {
    const first = await llm.chatJSON('desk', [{ role: 'user', content: 'hello' }]);
    assert.equal(first.data.ok, true);
    assert.equal(asked.filter((m) => m === 'gpt-oss:120b').length, 1, 'the spent model is tried once, not three times');
    asked.length = 0;
    await llm.chatJSON('desk', [{ role: 'user', content: 'again' }]);
    assert.deepEqual(asked.filter((m) => m.startsWith('gpt-oss')), [], 'the next call does not touch it at all');
  } finally {
    globalThis.fetch = original;
  }
});
