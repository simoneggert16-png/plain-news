// What a shift must never lose again.
//
// Three failures cost the desk a whole day each: a reply that carried its
// arguments next to a flag was read as no call at all, a model whose quota
// was used up was retried until the shift ran out, and a document the desk
// had read was thrown away because its headline did not repeat the story.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.OLLAMA_API_KEY ||= 'test-key';
process.env.NVIDIA_API_KEY ||= 'test-key';

const { runAgent } = await import('../bots/lib/agent.mjs');
const llm = await import('../bots/lib/llm.mjs');
const { pickCategory } = await import('../lib/investigations.mjs');

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
  // Braces inside strings, comments and template literals are not code.
  const scan = (from_, i, stop) => {
    let quote = null;
    for (; i < from_.length; i++) {
      const c = from_[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '/' && from_[i + 1] === '/') { i = from_.indexOf('\n', i); if (i < 0) return -1; continue; }
      if (c === '/' && from_[i + 1] === '*') { i = from_.indexOf('*/', i) + 1; continue; }
      if (stop(c)) return i;
    }
    return -1;
  };
  // The signature ends before the body begins.
  let i = at;
  let depth = 0;
  while (i < from.length) {
    const c = from[i];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (!depth) { i++; break; } }
    i++;
  }
  const body = scan(from, i, (c) => c === '{');
  if (body < 0) throw new Error(`${name} has no body`);
  let d = 0;
  const end = scan(from, body, (c) => {
    if (c === '{') { d++; return false; }
    if (c === '}') { d--; return d === 0; }
    return false;
  });
  if (end < 0) throw new Error(`${name} unterminated`);
  return from.slice(start, end + 1);
}

const documents = await import('../bots/lib/documents.mjs');
const DOC_SOURCE = fs.readFileSync(new URL('../bots/lib/documents.mjs', import.meta.url), 'utf8');
const wordsOf = (source, name) =>
  [...new Set(source.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`))[1].match(/'([^']+)'/g).map((w) => w.slice(1, -1)))];

// The story's own vocabulary: the helpers both the topic test and the press
// pass work with.
const story = new Function(`
  const STOPWORDS = new Set(${JSON.stringify(wordsOf(SOURCE, 'STOPWORDS'))});
  const MONTHS = new Set(${JSON.stringify(wordsOf(SOURCE, 'MONTHS'))});
  const FILLER = new Set(${JSON.stringify(wordsOf(SOURCE, 'FILLER'))});
  const GENERIC = new Set(${JSON.stringify(wordsOf(SOURCE, 'GENERIC'))});
  const BOILERPLATE = new Set(${JSON.stringify([...documents.BOILERPLATE])});
  const STOP = new Set(${JSON.stringify(wordsOf(DOC_SOURCE, 'STOP'))});
  const GENERIC_CAPS = new Set(${JSON.stringify(wordsOf(DOC_SOURCE, 'GENERIC_CAPS'))});
  const namedTerms = ${documents.namedTerms.toString()};
  ${take('wordPattern')}
  ${take('storyVocabulary')}
  ${take('sourceIsAboutStory')}
  return { wordPattern, storyVocabulary, sourceIsAboutStory };
`)();

const prune = new Function(`
  const STOPWORDS = new Set(${JSON.stringify(wordsOf(SOURCE, 'STOPWORDS'))});
  const MONTHS = new Set(${JSON.stringify(wordsOf(SOURCE, 'MONTHS'))});
  const FILLER = new Set(${JSON.stringify(wordsOf(SOURCE, 'FILLER'))});
  const GENERIC = new Set(${JSON.stringify(wordsOf(SOURCE, 'GENERIC'))});
  const NOT_A_SOURCE_HOSTS = new Set(${JSON.stringify(wordsOf(SOURCE, 'NOT_A_SOURCE_HOSTS'))});
  const BOILERPLATE = new Set(${JSON.stringify([...documents.BOILERPLATE])});
  const STOP = new Set(${JSON.stringify(wordsOf(DOC_SOURCE, 'STOP'))});
  const GENERIC_CAPS = new Set(${JSON.stringify(wordsOf(DOC_SOURCE, 'GENERIC_CAPS'))});
  const namedTerms = ${documents.namedTerms.toString()};
  const notASource = ${take('notASource')};
  const urlKey = ${take('urlKey')};
  const hostOf = ${take('hostOf')};
  const log = () => {};
  ${take('wordPattern')}
  ${take('storyVocabulary')}
  ${take('claimVocabulary')}
  ${take('claimSupportedBy')}
  return ${take('pruneOffTopic')};
`)();

const editorial = await import('../lib/editorial.mjs');
const addSource = new Function('isPrimaryOutlet', `
  const nowISO = () => new Date().toISOString();
  ${take('hostOf')}
  ${take('institutionHost')}
  return ${take('addSource')};
`)(editorial.isPrimaryOutlet);

// The desk takes a letter back when the story does not call for it. The
// letter has to leave the editor's desk as well as the desk's own list.
const withdraw = new Function('setOutreach', `
  const STOPWORDS = new Set(${JSON.stringify(wordsOf(SOURCE, 'STOPWORDS'))});
  const MONTHS = new Set(${JSON.stringify(wordsOf(SOURCE, 'MONTHS'))});
  const FILLER = new Set(${JSON.stringify(wordsOf(SOURCE, 'FILLER'))});
  const GENERIC = new Set(${JSON.stringify(wordsOf(SOURCE, 'GENERIC'))});
  const ORG_NOISE = new Set(${JSON.stringify(wordsOf(SOURCE, 'ORG_NOISE'))});
  const BOILERPLATE = new Set(${JSON.stringify([...documents.BOILERPLATE])});
  const STOP = new Set(${JSON.stringify(wordsOf(DOC_SOURCE, 'STOP'))});
  const GENERIC_CAPS = new Set(${JSON.stringify(wordsOf(DOC_SOURCE, 'GENERIC_CAPS'))});
  const namedTerms = ${documents.namedTerms.toString()};
  const SENT_STATES = ['sent', 'replied'];
  const log = () => {};
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };
  const nowISO = () => new Date().toISOString();
  ${take('hostOf')}
  ${take('wordPattern')}
  ${take('storyVocabulary')}
  ${take('sourceIsAboutStory')}
  ${take('mailHost')}
  ${take('orgIsInStory')}
  ${take('contactIsAboutStory')}
  ${take('stem')}
  ${take('orgTokens')}
  ${take('sameOrg')}
  ${take('ledger')}
  ${take('withdrawLetters')}
  ${take('pruneContacts')}
  return { pruneContacts, contactIsAboutStory };
`)(async () => {});

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

test('a claim carries its source alive', () => {
  const d = {
    ...STORY,
    claims: [{ id: 'C1', text: 'The publisher used the Itaewon crowd crush footage.', sources: ['S1'] }],
    sources: [
      { id: 'S1', url: 'https://example.org/c', outlet: 'Example', title: 'Statement', text: 'The publisher used the Itaewon crowd crush footage in the game.' },
    ],
  };
  prune(d);
  assert.equal(d.sources.length, 1);
});

test('a claim the document does not carry leaves the dossier', () => {
  const d = {
    ...STORY,
    claims: [{ id: 'C1', text: 'Activision Blizzard is an American video game holding company.', sources: ['S1'] }],
    sources: [
      { id: 'S1', url: 'https://example.org/c', outlet: 'Example', title: 'Statement', text: 'Foxconn unveils three electric vehicles to grow its contract manufacturing business.' },
    ],
  };
  prune(d);
  assert.equal(d.sources.length, 0, 'the document is about something else');
  assert.equal(d.claims.length, 0, 'a claim without a document is not a claim');
});

test('a claim that cites a document which left loses its citation', () => {
  const d = {
    ...STORY,
    claims: [
      { id: 'C1', text: 'The publisher used the Itaewon crowd crush footage.', sources: ['S1', 'S2'] },
      { id: 'C2', text: 'The publisher used the Itaewon crowd crush footage.', sources: ['S2'] },
    ],
    sources: [
      { id: 'S1', url: 'https://example.org/e', outlet: 'Example', title: 'The publisher used the Itaewon crowd crush footage.', text: null },
      { id: 'S2', url: 'https://example.org/f', outlet: 'Example', title: 'Unrelated fishing report', text: 'The council met about the harbour quota for sardines.' },
    ],
  };
  prune(d);
  assert.equal(d.sources.length, 1);
  assert.deepEqual(d.claims.find((c) => c.id === 'C1').sources, ['S1']);
  assert.equal(d.claims.find((c) => c.id === 'C2'), undefined, 'the claim without a document is gone');
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

test('a number a claim still holds is not handed out again', () => {
  const d = {
    ...STORY,
    claims: [{ id: 'C1', text: 'The publisher used the Itaewon crowd crush footage.', sources: ['S2'] }],
    sources: [
      { id: 'S1', url: 'https://example.org/g', outlet: 'Example', title: 'First', text: null },
    ],
  };
  addSource(d, { url: 'https://example.org/h', outlet: 'Example', title: 'Second' });
  assert.equal(d.sources[1].id, 'S3', 'S2 still belongs to the claim');
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
    const STOPWORDS = new Set(${JSON.stringify(wordsOf(SOURCE, 'STOPWORDS'))});
    const MONTHS = new Set(${JSON.stringify(wordsOf(SOURCE, 'MONTHS'))});
    const FILLER = new Set(${JSON.stringify(wordsOf(SOURCE, 'FILLER'))});
    const GENERIC = new Set(${JSON.stringify(wordsOf(SOURCE, 'GENERIC'))});
    const ORG_NOISE = new Set(${JSON.stringify(wordsOf(SOURCE, 'ORG_NOISE'))});
    const BOILERPLATE = new Set(${JSON.stringify([...documents.BOILERPLATE])});
    const STOP = new Set(${JSON.stringify(wordsOf(DOC_SOURCE, 'STOP'))});
    const GENERIC_CAPS = new Set(${JSON.stringify(wordsOf(DOC_SOURCE, 'GENERIC_CAPS'))});
    const namedTerms = ${documents.namedTerms.toString()};
    ${take('hostOf')}
    ${take('wordPattern')}
    ${take('storyVocabulary')}
    ${take('sourceIsAboutStory')}
    ${take('mailHost')}
    ${take('orgIsInStory')}
    ${take('contactIsAboutStory')}
    ${take('stem')}
    ${take('orgTokens')}
    ${take('sameOrg')}
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

// ───────────────────────── the mailbox is not a dossier ─────────────────────────

// The desk keeps its letters in the same folder as its dossiers. Only a
// dossier has a slug and a title; anything else in the folder is not one.
test('the desk’s mailbox is not a dossier', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-files-'));
  const folder = path.join(dir, 'content', 'investigations');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'state.json'), '{}');
  fs.writeFileSync(path.join(folder, 'index.json'), '{}');
  fs.writeFileSync(path.join(folder, 'inbox.json'), '[{"id":"F1","from_email":"press@example.org","status":"new"}]');
  fs.writeFileSync(path.join(folder, 'a-story.json'), JSON.stringify({ slug: 'a-story', title: 'A story' }));

  const load = new Function('fs', 'path', 'DOSSIER_DIR', `${take('loadDossiers')}; return loadDossiers;`)(fs, path, folder);
  const rows = load();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].slug, 'a-story');
});

// The desk keeps two kinds of lead apart. What the world published is public
// and may live in the repository; what a person wrote to the desk is not, and
// it never reaches the file the repository carries.
test('a tip that came by letter never reaches the public state file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-state-'));
  const folder = path.join(dir, 'content', 'investigations');
  fs.mkdirSync(folder, { recursive: true });
  const state = new Function(
    'fs', 'path', 'DOSSIER_DIR', 'STATE_FILE', 'LEADS_FILE',
    `${take('loadState')} ${take('saveState')} ${take('loadPrivateLeads')} ${take('savePrivateLeads')}
     return { loadState, saveState };`,
  )(fs, path, folder, path.join(folder, 'state.json'), path.join(folder, 'leads.json'));

  state.saveState({
    lastIntake: '2026-W44',
    leads: [
      { origin: 'scan', worth: true, title: 'A notice from the World Bank', url: 'https://contracts.worldbank.org/x' },
      { worth: true, title: 'A tip from a reader of the desk', summary: 'What the letter said' },
    ],
  });

  const shared = fs.readFileSync(path.join(folder, 'state.json'), 'utf8');
  assert.doesNotMatch(shared, /A tip from a reader of the desk/, 'the letter stays out of the repository');
  assert.match(shared, /A notice from the World Bank/);

  const priv = fs.readFileSync(path.join(folder, 'leads.json'), 'utf8');
  assert.match(priv, /A tip from a reader of the desk/);

  // The desk still knows both of them on the next shift.
  const back = state.loadState();
  assert.equal(back.leads.length, 2);
});

// ───────────────────── the editor frees a letter without the shelf ─────────────────────


// When the shared shelf does not answer, the decision travels with the run.
// The desk writes it into its own ledger, and the letter goes out from there.
function applyDecision(approve, reject = '') {
  const shelf = [];
  const apply = new Function(
    'APPROVE_LETTERS', 'REJECT_LETTERS', 'APPROVED_BY', 'safe', 'setOutreach', 'note', 'log', 'nowISO',
    `const parseLetterDecision = ${take('parseLetterDecision')};
     const ledger = ${take('ledger')};
     const applyLetterDecision = ${take('applyLetterDecision')};
     return applyLetterDecision;`,
  )(
    approve, reject, 'editor@example.org',
    async (fn) => { try { return await fn(); } catch { return null; } },
    async (ids, patch) => { shelf.push({ ids, patch }); },
    (d, status, message) => { d.history = [...(d.history || []), { status, note: message }]; },
    () => {},
    () => new Date().toISOString(),
  );
  return { apply, shelf };
}

test('an approval that comes with the run frees the letter in the desk’s ledger', async () => {
  const { apply, shelf } = applyDecision('a-story:L1');
  const d = {
    slug: 'a-story',
    letters: [{ id: 'L1', dbId: null, to_email: 'press@example.org', status: 'draft' }],
  };
  await apply(d);
  assert.equal(d.letters[0].status, 'approved');
  assert.equal(d.letters[0].approved_by, 'editor@example.org');
  assert.ok(d.letters[0].approved_at, 'the decision is dated');
  assert.equal(shelf.length, 0, 'a letter the shelf does not know is not written to it');
});

test('a letter the shelf knows by its number is freed too', async () => {
  const { apply, shelf } = applyDecision('a-story:42');
  const d = {
    slug: 'a-story',
    letters: [{ id: 'L2', dbId: 42, to_email: 'office@example.org', status: 'draft' }],
  };
  await apply(d);
  assert.equal(d.letters[0].status, 'approved');
  assert.equal(shelf.length, 1, 'the shelf is told when it is reachable');
  assert.equal(shelf[0].patch.status, 'approved');
});

test('a decision for one dossier leaves the others alone', async () => {
  const { apply } = applyDecision('a-story:L1');
  const d = {
    slug: 'another-story',
    letters: [{ id: 'L1', dbId: null, to_email: 'press@example.org', status: 'draft' }],
  };
  await apply(d);
  assert.equal(d.letters[0].status, 'draft');
});

// ───────────────────── a letter the desk kept becomes a story ─────────────────────

// The desk works internationally: a tip that is really about Swiss domestic
// affairs stays a tip.
function leadGate() {
  const marker = (name) => {
    const line = SOURCE.split('\n').find((l) => l.startsWith(`const ${name} = `));
    return line.slice(`const ${name} = `.length).replace(/;$/, '');
  };
  return new Function(`
    const SWISS_MARKER = ${marker('SWISS_MARKER')};
    const BORDER_MARKER = ${marker('BORDER_MARKER')};
    const BORDER_ACRONYM = ${marker('BORDER_ACRONYM')};
    const FOREIGN_MARKER = ${marker('FOREIGN_MARKER')};
    ${take('leadInternational')}
    return leadInternational;
  `)();
}

test('a tip about the world is the desk’s business', () => {
  const gate = leadGate();
  assert.equal(gate({ title: 'A mine in Congo takes the village’s farmland', angle: 'who paid for the concession', queries: ['congo mining concession land'] }).ok, true);
});

test('a tip about Swiss domestic affairs stays a tip', () => {
  const gate = leadGate();
  const r = gate({ title: 'Der Kanton verschiebt das Asylheim', angle: 'was kostet die Stadt', queries: ['kanton asylheim kosten'] });
  assert.equal(r.ok, false);
  assert.match(r.why, /Swiss/);
});

test('a Swiss story that crosses a border is the desk’s business', () => {
  const gate = leadGate();
  assert.equal(gate({ title: 'A Swiss bank moves money for a mining company', angle: 'international sanctions', queries: ['bank sanctions mining transfer'] }).ok, true);
});

// ───────────────────── the desk finds its own stories ─────────────────────

// The desk does not wait for a tip: it reads the front pages of the cabinets
// it follows and keeps the notices that deserve an investigation. The notice
// is the first document of the story — a story of its own starts with paper.
const NOTICES = [
  {
    outlet: 'US Department of Justice',
    title: 'Indictment in the export of dual-use chips to a shell company in Singapore',
    url: 'https://www.justice.gov/opa/pr/dual-use-chips',
  },
  {
    outlet: 'World Bank procurement',
    title: 'Notice: Contract award for the rehabilitation of a dam in Nigeria',
    url: 'https://contracts.worldbank.org/ViewContractNotice/abc',
  },
];

function scanner(reply, notices = NOTICES, chat = null) {
  const marker = (name) => {
    const line = SOURCE.split('\n').find((l) => l.startsWith(`const ${name} = `));
    return line.slice(`const ${name} = `.length).replace(/;$/, '');
  };
  return new Function(
    'chatJSON', 'cabinetFrontPage', 'log', 'nowISO', 'safe', 'deskMemory', 'memoryBlock', 'deadlineLeft', 'pickCategory',
    `
    const SWISS_MARKER = ${marker('SWISS_MARKER')};
    const BORDER_MARKER = ${marker('BORDER_MARKER')};
    const BORDER_ACRONYM = ${marker('BORDER_ACRONYM')};
    const FOREIGN_MARKER = ${marker('FOREIGN_MARKER')};
    ${take('leadInternational')}
    ${take('scanForLeads')}
    return scanForLeads;
    `,
  )(
    chat || (async () => ({ data: reply })),
    async () => notices,
    () => {},
    () => '2026-10-31T08:00:00.000Z',
    async (fn, fallback) => {
      try {
        return await fn();
      } catch {
        return fallback;
      }
    },
    () => ({ published: [], open: [], beats: [], followups: [], leads: [], finds: [] }),
    () => '',
    () => 600_000,
    pickCategory,
  );
}

const WORLD_PICK = {
  n: 1,
  worth: true,
  summary: 'A shell company in Singapore bought chips that need an export licence.',
  title: 'A shell company in Singapore bought the chips it was not allowed to ship',
  angle: 'Who bought the dual-use chips and who signed the export licence',
  centre: 'Singapore',
  people: 'The buyers hide behind a shell company; the licences are on paper',
  queries: ['dual-use chip export Singapore shell company indictment'],
};

test('the desk finds a story of its own in the front pages of the cabinets', async () => {
  const state = { leads: [] };
  const added = await scanner({ leads: [WORLD_PICK] })(state, []);
  assert.equal(added, 1);
  assert.equal(state.leads.length, 1);
  assert.equal(state.leads[0].origin, 'scan');
  assert.equal(state.leads[0].worth, true);
  assert.equal(state.leads[0].url, NOTICES[0].url, 'the notice the desk found is kept with its address');
  assert.match(state.leads[0].title, /shell company/i);
});

test('a notice about one country’s own business does not become a story', async () => {
  const state = { leads: [] };
  const added = await scanner({
    leads: [{
      n: 2,
      worth: true,
      summary: 'Der Kanton verschiebt das Asylheim.',
      title: 'Der Kanton verschiebt das Asylheim',
      angle: 'was kostet die Stadt',
      centre: 'Switzerland',
      people: 'die Bewohnerinnen',
      queries: ['kanton asylheim kosten'],
    }],
  })(state, []);
  assert.equal(added, 0);
  assert.equal(state.leads.length, 0);
});

test('the desk reads the cabinets once a day', async () => {
  const state = { leads: [] };
  const scan = scanner({ leads: [WORLD_PICK] });
  assert.equal(await scan(state, []), 1);
  assert.equal(state.lastScan, '2026-10-31');
  assert.equal(await scan(state, []), 0, 'the second run of the day reads nothing new');
  assert.equal(state.leads.length, 1);
});

test('a notice the desk already keeps is not kept twice', async () => {
  const state = { leads: [{ origin: 'scan', url: NOTICES[0].url, title: 'An older find', worth: true }] };
  const added = await scanner({ leads: [WORLD_PICK] })(state, []);
  assert.equal(added, 0);
  assert.equal(state.leads.length, 1);
});

test('a desk with a full list does not lose the notice it just found', async () => {
  const old = Array.from({ length: 20 }, (_, i) => ({
    origin: 'scan', worth: true, title: `An older find ${i}`, url: `https://example.org/${i}`,
  }));
  const state = { leads: old };
  await scanner({ leads: [WORLD_PICK] })(state, []);
  assert.equal(state.leads.length, 20);
  assert.equal(state.leads[0].title, WORLD_PICK.title, 'the newest find stays on the desk');
});

test('the desk does not search the same words twice', () => {
  const overlap = new Function(`${take('queryOverlap')}; return queryOverlap;`)();
  const t = (s) => new Set(s.toLowerCase().split(/\s+/));
  // One shift searched this story twelve times; six of those were the same
  // query with a year or an outlet name added.
  assert.ok(overlap(
    t('Activision Blizzard Itaewon court case South Korea 2024'),
    t('Activision Blizzard Itaewon court ruling South Korea'),
  ) > 0.8, 'a year added is the same search');
  assert.ok(overlap(t('Call of Duty Itaewon lawsuit'), t('World Bank Kenya solar contract')) < 0.3, 'a different story is not a repeat');
});

test('the desk recognises the same search in another script', () => {
  // A shift in Seoul searched five times in Korean. termsOf keeps only Latin
  // letters, so all five looked new to the guard.
  const src = SOURCE.slice(SOURCE.indexOf('const SCRIPT_WORD = ') + 'const SCRIPT_WORD = '.length);
  const { scriptWords, queryOverlap } = new Function(`
    const SCRIPT_WORD = ${src.split(';')[0]};
    ${take('scriptWords')}
    ${take('queryOverlap')}
    return { scriptWords, queryOverlap };
  `)();
  assert.deepEqual(scriptWords('이태원 붕괴 사건 소송'), ['이태원', '붕괴', '사건', '소송']);
  assert.deepEqual(scriptWords('World Bank Kenya'), [], 'Latin words are not duplicated');
  const tokens = (q) => new Set([...scriptWords(q), ...(q.toLowerCase().match(/[a-z]{3,}/g) || [])]);
  assert.ok(queryOverlap(
    tokens('이태원 붕괴 영상 Call of Duty 소송'),
    tokens('이태원 붕괴 영상 소송 판결'),
  ) >= 0.8, 'the same Korean search with a word changed is a repeat');
  assert.ok(queryOverlap(tokens('이태원 붕괴 영상 소송'), tokens('부산 항만 파업 노조')) < 0.3, 'another Korean story is not');
});

test('the outlet’s own name does not make a story match', () => {
  // The dossier about Call of Duty held a Yonhap headline about baseball:
  // the search started with "Yonhap", and the wire matched the agency's name.
  const wireHit = new Function(`${take('wireHit')}; return wireHit;`)();
  const terms = ['yonhap', 'call', 'duty', 'publisher', 'apologizes', 'using', 'real', 'footage'];
  const distinctive = terms.filter((t) => t.length >= 6);
  const baseball = {
    outlet: 'Yonhap',
    title: 'KBO asks MLB to post All-Star slugger Roh Si-hwan | Yonhap News Agency',
    summary: 'SEOUL, Oct 31 (Yonhap) — The KBO asked MLB to post the slugger.',
  };
  const game = {
    outlet: 'Yonhap',
    title: 'Call of Duty publisher apologizes for using real footage of Itaewon crowd crush',
    summary: 'SEOUL (Yonhap) — The publisher said it would remove the footage.',
  };
  assert.equal(wireHit(baseball, terms, distinctive).score, 0, 'only the agency name is shared');
  assert.ok(wireHit(game, terms, distinctive).score >= 4, 'the game story shares the story’s words');
});

test('the same finding written twice is one claim — unless a figure differs', () => {
  // Eleven claims on the Call of Duty dossier were seven facts: the
  // extraction runs every shift and phrases the same sentence anew.
  const sameClaim = new Function(`
    ${take('queryOverlap')}
    ${take('sameClaim')}
    return sameClaim;
  `)();
  const apologized = 'Activision Publishing apologized for the use of the footage and agreed to remove it in an update scheduled for November 12, 2026.';
  const apologizedAgain = 'Activision apologized for use of the footage and agreed to remove it in an update scheduled for November 12, 2026.';
  const families = 'Bereaved families criticized the game publisher for lacking common sense and demanded complete removal of the clip.';
  const familiesAgain = 'Bereaved families criticized the game publisher for lacking common sense and demanded a complete removal of the clip.';
  assert.equal(sameClaim(apologized, apologizedAgain), true, 'the house name added is the same fact');
  assert.equal(sameClaim(families, familiesAgain), true, 'an article added is the same fact');
  assert.equal(sameClaim(
    'The Itaewon crowd crush killed 159 people on 29 October 2022.',
    'The Itaewon crowd crush killed 158 people on 29 October 2022.',
  ), false, 'two figures are two claims');
  assert.equal(sameClaim(apologized, families), false, 'two facts that share words are two claims');
});

test('a notice without a subject supports no story', async () => {
  // OP00478199 is a contract award for a road project in the Kyrgyz Republic.
  // Its feed title was "Contract Award: ", and the model turned it into
  // "$200M for renewable energy in Kenya" — nothing in the notice says so.
  const empty = [{ outlet: 'World Bank procurement', title: 'Contract Award: ', url: 'https://contracts.worldbank.org/ViewContractNotice/OP00478199' }];
  const state = { leads: [] };
  const added = await scanner({ leads: [{
    n: 1,
    worth: true,
    summary: 'The bank awarded a contract for renewable energy in Kenya.',
    title: 'World Bank awards $200M contract for renewable energy in Kenya',
    angle: 'Who benefits from the contract',
    centre: 'Kenya',
    people: 'local communities',
    queries: ['world bank kenya renewable contract award'],
  }] }, empty)(state, []);
  assert.equal(added, 0, 'a pick from a nameless notice is not filed');
  assert.equal(state.leads.length, 0);
});

test('a model that answers with prose does not cost the desk the whole day', async () => {
  // Production: "No valid JSON could be extracted from response: We need to
  // output JSON with leads array…". The first shift lost its scan to that.
  const many = Array.from({ length: 20 }, (_, i) => ({
    outlet: `Cabinet ${i}`,
    title: `Indictment in the export of dual-use chips to a shell company ${i}`,
    url: `https://example.org/notice/${i}`,
  }));
  const calls = [];
  const chat = async (_model, _messages, options) => {
    calls.push(options);
    if (calls.length === 1) throw new Error('No valid JSON could be extracted from response');
    return { data: { leads: [WORLD_PICK] } };
  };
  const state = { leads: [] };
  const added = await scanner(null, many, chat)(state, []);
  assert.equal(calls.length, 2, 'the desk asks a second time');
  assert.ok(calls[1].maxTokens > calls[0].maxTokens, 'the second answer has more room');
  assert.ok(calls[1].temperature < calls[0].temperature, 'the second answer is cooler');
  assert.equal(added, 1, 'the story found in the second pass is kept');
  assert.equal(state.leads[0].url, many[0].url, 'the pick maps to the notices of the second pass');
});

test('a front page with few notices is asked again too', async () => {
  const calls = [];
  const chat = async (_model, _messages, options) => {
    calls.push(options);
    if (calls.length === 1) throw new Error('No valid JSON could be extracted from response');
    return { data: { leads: [WORLD_PICK] } };
  };
  const state = { leads: [] };
  const added = await scanner(null, NOTICES, chat)(state, []);
  assert.equal(calls.length, 2, 'fewer notices is no reason to give the day up');
  assert.equal(added, 1);
});

// ───────────────────── who the desk writes to ─────────────────────

// The desk writes to the institution whose document it holds. A news site is
// not an institution, not even when its name carries a word like "court".
test('an institution has its own domain', () => {
  const isInstitution = new Function(`${take('institutionHost')}; return institutionHost;`)();
  assert.equal(isInstitution('justice.gov'), true);
  assert.equal(isInstitution('www.gov.uk'), true);
  assert.equal(isInstitution('un.org'), true);
  assert.equal(isInstitution('ec.europa.eu'), true);
  assert.equal(isInstitution('courtnewsdaily.com'), false);
  assert.equal(isInstitution('en.yna.co.kr'), false);
  assert.equal(isInstitution('asia.nikkei.com'), false);
  // The desk reads the world: a Korean court, a French ministry, a Mexican
  // ministry and the Swiss administration are institutions too.
  assert.equal(isInstitution('scourt.go.kr'), true);
  assert.equal(isInstitution('www.gouv.fr'), true);
  assert.equal(isInstitution('www.gob.mx'), true);
  assert.equal(isInstitution('admin.ch'), true);
  assert.equal(isInstitution('go.com'), false, 'a portal is not a public body');
});

test('a ruling from a Korean court is a primary document', () => {
  // Web hits come with the host as the outlet. A .go.kr address is an
  // institution even though the name says nothing a pattern would know.
  const d = { ...STORY, claims: [], sources: [] };
  addSource(d, {
    url: 'https://www.scourt.go.kr/board/news/123',
    outlet: 'scourt.go.kr',
    title: 'Seoul High Court ruling on the use of the footage',
  });
  assert.equal(d.sources[0].primary, true);
  const news = { ...STORY, claims: [], sources: [] };
  addSource(news, { url: 'https://en.yna.co.kr/view/AEN20261030011500320', outlet: 'en.yna.co.kr', title: 'Yonhap report' });
  assert.equal(news.sources[0].primary, false, 'a wire is not a primary document');
});

// The desk files the organisation while it works and finds the address later.
// When the address arrives, the organisation is not filed a second time — a
// desk that writes twice to the same desk looks like a machine.
function pressPass() {
  return new Function(
    'publishedEmail', 'sameOrg', 'hostOf', 'institutionHost', 'log', 'deadlineLeft', 'sourceIsAboutStory',
    `${take('fileContacts')}; return fileContacts;`,
  )(
    async (host) => ({ email: `press@${host}`, sourceUrl: `https://${host}/press` }),
    (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(),
    new Function(`${take('hostOf')}; return hostOf;`)(),
    new Function(`${take('institutionHost')}; return institutionHost;`)(),
    () => {},
    () => 600_000,
    story.sourceIsAboutStory,
  );
}

test('the address fills the contact the desk already filed', async () => {
  const fill = pressPass();
  const d = {
    sources: [{ url: 'https://www.trmlabs.com/report', outlet: 'TRM Labs', kind: 'document' }],
    contacts: [{ org: 'TRM Labs', role: 'must be asked for comment' }],
  };
  assert.equal(await fill(d), 1);
  assert.equal(d.contacts.length, 1, 'the organisation must not be filed twice');
  assert.equal(d.contacts[0].email, 'press@trmlabs.com');
  assert.equal(d.contacts[0].emailSource, 'https://trmlabs.com/press');
});

test('an institution the desk has not met yet is filed with its address', async () => {
  const fill = pressPass();
  const d = {
    sources: [{ url: 'https://www.justice.gov/opa/pr/indictment', outlet: 'US Department of Justice', kind: 'document' }],
    contacts: [],
  };
  assert.equal(await fill(d), 1);
  assert.equal(d.contacts.length, 1);
  assert.equal(d.contacts[0].org, 'US Department of Justice');
  assert.equal(d.contacts[0].email, 'press@justice.gov');
});

test('a press release about something else earns no letter', async () => {
  const fill = pressPass();
  const d = {
    title: 'Call of Duty uses Seoul crowd crush footage',
    angle: 'Did the US game developer exploit a tragedy for profit?',
    brief: { centre: 'South Korea', beat: 'Activision Blizzard' },
    sources: [
      {
        url: 'https://www.justice.gov/opa/pr/botox-fraud-doctor-sentenced',
        outlet: 'US Department of Justice',
        kind: 'document',
        title: 'Botox Fraud Doctor Sentenced to 15 Years in Prison for $45M Medicare Scheme',
        text: 'The defendant prescribed Botox and other drugs to Medicare patients for $45 million. The case was prosecuted by the United States Attorney for the District.',
      },
    ],
    contacts: [],
  };
  assert.equal(await fill(d), 0);
  assert.equal(d.contacts.length, 0, 'a reporter does not ask the Justice Department about a game publisher');
});

test('a news site is not an institution, so no letter goes to it', async () => {
  const fill = pressPass();
  const d = {
    sources: [{ url: 'https://en.yna.co.kr/view/AEN2026', outlet: 'Yonhap', kind: 'read' }],
    contacts: [],
  };
  assert.equal(await fill(d), 0);
  assert.equal(d.contacts.length, 0);
});

// The letter to the Justice Department was drafted and waiting on the editor's
// desk. The desk has to take it back itself: the story does not concern the
// Justice Department, so the editor should never have been offered that letter.
test('a letter to an institution the story does not concern is taken back', async () => {
  const d = {
    title: 'Call of Duty uses Seoul crowd crush footage',
    angle: 'Did the US game developer exploit a tragedy for profit?',
    brief: { centre: 'South Korea', beat: 'Activision Blizzard' },
    sources: [
      {
        id: 'S1',
        url: 'https://en.yna.co.kr/view/AEN20261030011500320',
        outlet: 'Yonhap',
        kind: 'read',
        title: 'Call of Duty publisher apologizes for using real footage of Itaewon crowd crush',
        text: 'Activision Publishing apologized for using real footage of the 2022 Itaewon crowd crush in Call of Duty: Modern Warfare. The game was developed by Infinity Ward and Sledgehammer Games.',
      },
      {
        id: 'S4',
        url: 'https://www.justice.gov/opa/pr/botox-fraud-doctor-sentenced',
        outlet: 'US Department of Justice',
        kind: 'document',
        title: 'Botox Fraud Doctor Sentenced to 15 Years in Prison for $45M Medicare Scheme',
        text: 'The defendant prescribed Botox and other drugs to Medicare patients for $45 million. The case was prosecuted by the United States Attorney for the District.',
      },
    ],
    claims: [
      { id: 'C1', text: 'Activision Publishing used real footage of the 2022 Seoul Itaewon crowd crush.', sources: ['S1'] },
    ],
    gaps: ['What statements did Infinity Ward and Sledgehammer Games make about the footage?'],
    contacts: [
      { org: 'US Department of Justice', role: 'the institution whose document is on file', email: 'press@usdoj.gov', emailSource: 'https://www.justice.gov/opa/webform/media-inquiries' },
      { org: 'Infinity Ward / Sledgehammer Games', role: 'To explain the creative decision-making process.', email: 'info@sledgehammergames.com', emailSource: 'https://www.sledgehammergames.com/' },
    ],
    letters: [
      { id: 'L1', to_email: 'press@usdoj.gov', org: 'US Department of Justice', status: 'draft', dbId: 'row-1' },
      { id: 'L2', to_email: 'info@sledgehammergames.com', org: 'Infinity Ward / Sledgehammer Games', status: 'draft', dbId: 'row-2' },
    ],
  };
  assert.equal(await withdraw.pruneContacts(d), 1, 'only the Justice Department is not part of this story');
  assert.equal(d.contacts[0].withdrawn, true);
  assert.equal(d.letters[0].status, 'declined', 'the letter must not wait on the editor');
  assert.equal(d.letters[0].withdrawn, true);
  assert.equal(d.letters[1].status, 'draft', 'the letter to the studio stays');
  assert.equal(d.contacts[1].withdrawn, undefined);
});

// The observation is cut off at 3200 characters. What has to survive the cut
// is the guidance and the list of urls the model can still open — the pages
// the desk read are on file already, and the desk writes down what they prove.
test('the guidance and the urls come before the excerpts', () => {
  const at = SOURCE.indexOf("...(notes.length ? { note: notes.join(' — ') } : {}),");
  assert.ok(at > 0, 'the note must come first in the search result');
  const block = SOURCE.slice(at, at + 700);
  const noteAt = block.indexOf('note:');
  const resultsAt = block.indexOf('results,');
  const openedAt = block.indexOf('opened:');
  assert.ok(noteAt >= 0, 'the search result has no note');
  assert.ok(resultsAt > noteAt, 'the urls must come before the excerpts');
  assert.ok(openedAt > resultsAt, 'the excerpts come last');
});

// ───────────────────────── the shift has to be finished ─────────────────────────

// The desk works in shifts, and a shift is not over when the model stops
// talking. The reading back, the addresses and the letters come after the
// model — so the model may not have all the time.
const share = new Function(`${take('modelShare')}; return modelShare;`)();

test('the model does not get the whole shift', () => {
  assert.equal(share(18 * 60_000), 480_000, 'eight minutes for the model, the rest for the work behind it');
  assert.ok(share(18 * 60_000) < 18 * 60_000, 'the model must leave time for the rest');
  assert.equal(share(8 * 60_000), 264_000, 'a short shift is shared in the same way');
  assert.equal(share(60_000), 150_000, 'a very short shift still gives the model a workable slice');
  assert.equal(share(24 * 3600_000), 480_000, 'a long shift does not give the model endless time');
  assert.equal(share(0), 0, 'without a budget there is no deadline to hand out');
});

test('the address hunt runs before the model spends the shift', () => {
  const loop = SOURCE.slice(SOURCE.indexOf('for (const d of targets) {'));
  const huntAt = loop.indexOf('fillContactAddresses(d)');
  const modelAt = loop.indexOf('await research(d)');
  assert.ok(huntAt > 0, 'the shift must look for the addresses');
  assert.ok(modelAt > 0, 'the shift must run the model');
  assert.ok(huntAt < modelAt, 'the addresses are found before the model takes the time');
});

test('a link in the search box is read, not searched for', () => {
  const url = new Function(`${take('looksLikeUrl')}; return looksLikeUrl;`)();
  assert.equal(url('https://en.yna.co.kr/view/AEN20261030011500320'), true);
  assert.equal(url('Activision Blizzard crowd crush footage'), false);
  const at = SOURCE.indexOf('if (looksLikeUrl(q)) {');
  assert.ok(at > 0, 'the search must recognise a link');
  assert.ok(SOURCE.slice(at, at + 400).includes('readPage(q)'), 'the link must be opened');
});

test('the address hunt does not need more time than the model leaves', () => {
  // The hunt starts when the model is done. If its guard asked for more than
  // the model ever leaves, the desk would never write a letter.
  const guard = SOURCE.slice(SOURCE.indexOf('async function fillContactAddresses')).slice(0, 900);
  const need = Number(guard.match(/deadlineLeft\(\) < (\d+)/)?.[1] || 0);
  assert.ok(need > 0, 'the hunt needs a guard');
  assert.ok(need <= 60_000, `the hunt waits for ${need} ms — the model leaves less`);
});

test('a category a model invents is not a section of the paper', () => {
  // Two of the desk's first scan leads came back as "politics|business" and
  // "business|world": two sections in one field, neither of them valid.
  assert.equal(pickCategory('politics|business'), 'politics');
  assert.equal(pickCategory('business|world'), 'business');
  assert.equal(pickCategory('World / Politics'), 'world');
  assert.equal(pickCategory('Law & Order'), 'world', 'no known section → the fallback');
  assert.equal(pickCategory(undefined), 'world');
  assert.equal(pickCategory('health'), 'health');
});

test('a story that three shifts could not grow past one report is parked', () => {
  const park = new Function(`
    const nowISO = () => '2026-10-31T00:00:00.000Z';
    const log = () => {};
    ${take('note')}
    return ${take('parkIfHopeless')};
  `)();
  const dossier = (over = {}) => ({
    slug: 'call-of-duty-uses-seoul-footage',
    status: 'research',
    sources: [{ id: 'S1' }],
    blankShifts: 3,
    ...over,
  });

  const stuck = dossier();
  assert.equal(park(stuck), true);
  assert.equal(stuck.status, 'dropped', 'the dossier leaves the active list');
  assert.match(stuck.parkReason, /three shifts without a new source/);
  assert.equal(stuck.history.at(-1).status, 'dropped', 'the reason is in the file, not only in the log');

  assert.equal(park(dossier({ blankShifts: 2 })), false, 'two empty shifts are a normal week');
  assert.equal(park(dossier({ sources: [{ id: 'S1' }, { id: 'S2' }, { id: 'S3' }] })), false, 'a story with footing is not parked');
  assert.equal(park(dossier({ letters: [{ id: 'L1', status: 'draft', sentAt: '2026-10-31T10:00:00.000Z' }] })), false, 'a letter in flight is still a story');
});
