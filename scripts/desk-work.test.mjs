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

// The shape the model actually sent on 2026-10-30, twelve steps into the
// Seoul story: the tool named by its key, the arguments inside it. The shift
// was lost on it because the loop did not know the shape.
test('a tool named by its key is still a call', async () => {
  const call = await firstCall({
    thought: 'We need to open the Yonhap article.',
    open: { url: 'https://en.yna.co.kr/view/AEN20261030011500320' },
  });
  assert.equal(call?.tool, 'open');
  assert.match(call.args.url, /yna\.co\.kr/);
});

test('a tool named by its key with a plain value is still a call', async () => {
  const call = await firstCall({ open: 'https://example.org/e' });
  assert.equal(call?.tool, 'open');
  assert.equal(call.args.url, 'https://example.org/e');
});

test('a tool that carries its own name and arguments is still a call', async () => {
  const call = await firstCall({ tool: { name: 'open', arguments: { url: 'https://example.org/f' } } });
  assert.equal(call?.tool, 'open');
  assert.equal(call.args.url, 'https://example.org/f');
});

test('a key that names no tool is not a call', async () => {
  const call = await firstCall({ thought: 'I have nothing to do here.', note: { text: 'later' } });
  assert.equal(call, null);
});

test('a flag the tool documents is kept', async () => {
  const call = await firstCall({ action: 'save_claim', text: 'The publisher used the footage without asking.', sources: ['S1'], contested: false });
  assert.equal(call?.tool, 'save_claim');
  assert.equal(call.args.contested, false);
});

test('a reply with nothing to do calls no tool', async () => {
  assert.equal(await firstCall({ thought: 'I have nothing to do here.' }), null);
});

// A model that explains itself and then acts: the call hides behind the
// prose, and the shift was lost on it because the loop only looked at the
// parsed object.
test('the call behind the prose is still a call', async () => {
  const calls = [];
  const text = 'We need to open the Yonhap article. The tool search was used repeatedly; we should use open directly. Let\'s try open. {"open":{"url":"https://en.yna.co.kr/view/AEN20261030011500320"}}';
  await runAgent({
    role: 'desk',
    system: 'test',
    task: 'test',
    tools: TOOLS.map((t) => ({ ...t, run: async (a) => { calls.push({ tool: t.name, args: a }); return { ok: true }; } })),
    maxSteps: 1,
    ask: async () => ({ data: { thought: "We need to open the Yonhap article." }, text }),
    log: () => {},
  });
  assert.equal(calls[0]?.tool, 'open');
  assert.match(calls[0].args.url, /yna\.co\.kr/);
});

// The same question twice must not cost the shift a minute it cannot get
// back: the desk answers from what it already has and tells the model to
// change course.
test('the same question twice does not run the tool again', async () => {
  const calls = [];
  const reply = { action: 'search', args: { query: 'yonhap itaewon publisher' } };
  const out = await runAgent({
    role: 'desk',
    system: 'test',
    task: 'test',
    tools: TOOLS.map((t) => ({ ...t, run: async (a) => { calls.push({ tool: t.name, args: a }); return { items: ['one headline'] }; } })),
    maxSteps: 2,
    ask: async () => ({ data: reply, text: JSON.stringify(reply) }),
    log: () => {},
  });
  assert.equal(calls.length, 1, 'the tool runs once');
  assert.match(out.observations[1], /you already asked that/);
  assert.match(out.observations[1], /one headline/, 'the answer the desk already has is handed back');
});

test('the third identical call is refused', async () => {
  const calls = [];
  const reply = { action: 'search', args: { query: 'yonhap itaewon publisher' } };
  const out = await runAgent({
    role: 'desk',
    system: 'test',
    task: 'test',
    tools: TOOLS.map((t) => ({ ...t, run: async (a) => { calls.push({ tool: t.name, args: a }); return { items: [] }; } })),
    maxSteps: 3,
    ask: async () => ({ data: reply, text: JSON.stringify(reply) }),
    log: () => {},
  });
  assert.equal(calls.length, 1, 'the tool does not run again');
  assert.match(out.observations[2], /same arguments 3 times/);
});

// ───────────────────────── the desk keeps what it read ─────────────────────────

const SOURCE = fs.readFileSync(new URL('../bots/investigate.mjs', import.meta.url), 'utf8');

// The dossier file is a script, not a library: the function is taken out of
// it as it stands, so the test cannot drift away from the code.
function take(name, from = SOURCE) {
  const at = from.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} not found`);
  const start = from.slice(Math.max(0, at - 6), at) === 'async ' ? at - 6 : at;
  let depth = 0;
  let opened = false;
  for (let i = start; i < from.length; i++) {
    if (from[i] === '{') { depth++; opened = true; }
    else if (from[i] === '}' && --depth === 0 && opened) return from.slice(start, i + 1);
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

// ───────────────────────── the desk keeps its own mailbox ─────────────────────────

// The shelf in the database may be gone for days. The desk still has to be
// able to write down a letter, read the editor's decision and know what it
// has already sent.
function desk({ shelf = [], approve = '' } = {}) {
  return new Function(`
    const DB_FIELDS = ${JSON.stringify(SOURCE.match(/const DB_FIELDS = \[([^\]]*)\];/)[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean))};
    const REMINDER_AFTER_DAYS = ${SOURCE.match(/const REMINDER_AFTER_DAYS = (\d+)/)[1]};
    const REMINDERS_PER_LETTER = ${SOURCE.match(/const REMINDERS_PER_LETTER = (\d+)/)[1]};
    const SENT_STATES = ['sent', 'replied'];
    const APPROVE_LETTERS = ${JSON.stringify(approve)};
    const REJECT_LETTERS = '';
    const APPROVED_BY = 'editor';
    const log = () => {};
    const nowISO = () => new Date().toISOString();
    const note = () => {};
    const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };
    const listOutreach = async () => ${JSON.stringify(shelf)};
    const requestOutreach = async () => { throw new Error('no table'); };
    const setOutreach = async () => { throw new Error('no table'); };
    ${take('ledger')}
    ${take('nextLetterId')}
    ${take('letterRow')}
    ${take('saveLetter')}
    ${take('outreachRows')}
    ${take('queueOutreach')}
    ${take('queueReminders')}
    ${take('parseLetterDecision')}
    ${take('applyLetterDecision')}
    return { queueOutreach, queueReminders, outreachRows, applyLetterDecision, ledger };
  `)();
}

test('a letter the desk found in a document stays in its own ledger', async () => {
  const { queueOutreach, ledger } = desk();
  const d = { slug: 'a-story', contacts: [{ email: 'press@example.org', org: 'Example Press', emailSource: 'example.org' }] };
  const queued = await queueOutreach(d);
  assert.equal(queued, 1);
  assert.equal(d.letters.length, 1);
  assert.equal(d.letters[0].status, 'requested');
  assert.equal(d.letters[0].to_email, 'press@example.org');
});

test('the same address is not asked twice', async () => {
  const { queueOutreach } = desk();
  const d = { slug: 'a-story', contacts: [{ email: 'press@example.org', org: 'Example Press' }] };
  await queueOutreach(d);
  await queueOutreach(d);
  assert.equal(d.letters.length, 1);
});

test('the editor frees a letter on the shelf', async () => {
  const { outreachRows } = desk({ shelf: [{ id: 7, slug: 'a-story', to_email: 'press@example.org', status: 'approved' }] });
  const d = { slug: 'a-story', letters: [] };
  const rows = await outreachRows(d);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'approved');
});

test('a letter that went out is not sent a second time', async () => {
  const { outreachRows } = desk({ shelf: [{ id: 7, slug: 'a-story', to_email: 'press@example.org', status: 'approved' }] });
  const d = {
    slug: 'a-story',
    letters: [{ id: 'L1', to_email: 'press@example.org', status: 'sent', sent_at: '2026-10-30T10:00:00Z' }],
  };
  const rows = await outreachRows(d);
  assert.equal(rows[0].status, 'sent');
});

test('the editor frees a letter that only the desk knows about', async () => {
  const { applyLetterDecision } = desk({ approve: 'a-story:L1' });
  const d = { slug: 'a-story', letters: [{ id: 'L1', to_email: 'press@example.org', status: 'draft' }] };
  await applyLetterDecision(d);
  assert.equal(d.letters[0].status, 'approved');
  assert.equal(d.letters[0].approved_by, 'editor');
});

test('a decision for another dossier touches nothing', async () => {
  const { applyLetterDecision } = desk({ approve: 'another-story:L1' });
  const d = { slug: 'a-story', letters: [{ id: 'L1', to_email: 'press@example.org', status: 'draft' }] };
  await applyLetterDecision(d);
  assert.equal(d.letters[0].status, 'draft');
});

// A letter that was sent and got no answer is an open question. A desk asks
// again — and the reminder waits for the editor like every other letter.
test('a letter without an answer is asked again', async () => {
  const { queueReminders } = desk();
  const longAgo = new Date(Date.now() - 20 * 864e5).toISOString();
  const d = {
    slug: 'a-story',
    letters: [{ id: 'L1', to_email: 'press@example.org', org: 'Example Press', status: 'sent', sent_at: longAgo }],
  };
  assert.equal(await queueReminders(d), 1);
  assert.equal(d.letters.length, 2);
  assert.equal(d.letters[1].reminds, 'L1');
  assert.equal(d.letters[1].status, 'requested');
  assert.equal(d.letters[1].to_email, 'press@example.org');
});

test('a letter that was answered is not asked again', async () => {
  const { queueReminders } = desk();
  const longAgo = new Date(Date.now() - 20 * 864e5).toISOString();
  const d = {
    slug: 'a-story',
    letters: [{ id: 'L1', to_email: 'press@example.org', org: 'Example Press', status: 'replied', sent_at: longAgo }],
  };
  assert.equal(await queueReminders(d), 0);
  assert.equal(d.letters.length, 1);
});

test('the same letter is not chased over and over', async () => {
  const { queueReminders } = desk();
  const longAgo = new Date(Date.now() - 20 * 864e5).toISOString();
  const d = {
    slug: 'a-story',
    letters: [
      { id: 'L1', to_email: 'press@example.org', org: 'Example Press', status: 'sent', sent_at: longAgo },
      { id: 'L2', to_email: 'press@example.org', org: 'Example Press', status: 'requested', reminds: 'L1' },
    ],
  };
  await queueReminders(d);
  assert.equal(d.letters.filter((l) => l.reminds === 'L1').length, 1);
});

// The editor's desk: a request and its reminder are two letters, even when
// they go to the same address.
const ADMIN = fs.readFileSync(new URL('../app/api/admin/investigations/route.js', import.meta.url), 'utf8');
const mergeOutreach = new Function(`${take('mergeOutreach', ADMIN)}; return mergeOutreach;`)();

test('a request and its reminder are two letters on the editor’s desk', () => {
  const letters = [
    { id: 'L1', dbId: 7, slug: 'a-story', to_email: 'press@example.org', subject: 'Request', body: 'the questions', status: 'sent' },
    { id: 'L2', dbId: 8, slug: 'a-story', to_email: 'press@example.org', subject: 'Reminder', body: 'still waiting', status: 'draft' },
  ];
  const shelf = [
    { id: 7, slug: 'a-story', to_email: 'press@example.org', subject: 'Request', body: '', status: 'sent' },
    { id: 8, slug: 'a-story', to_email: 'press@example.org', subject: '', body: '', status: 'requested' },
  ];
  const rows = mergeOutreach(shelf, letters);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.id === 7).body, 'the questions');
  assert.equal(rows.find((r) => r.id === 8).body, 'still waiting');
});

test('a letter the shelf does not know is still on the editor’s desk', () => {
  const rows = mergeOutreach([], [
    { id: 'L3', dbId: null, slug: 'a-story', to_email: 'press@example.org', subject: 'Request', body: 'the questions', status: 'draft' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'L3');
  assert.equal(rows[0].body, 'the questions');
});
