// Smoke test for the desk agent loop — no API key, no network.
// Run: node scripts/test-agent.mjs
import { runAgent } from '../bots/lib/agent.mjs';

const calls = [];
const tools = [
  {
    name: 'lookup',
    args: '{"term": string}',
    description: 'pretend search',
    run: async ({ term }) => {
      calls.push(term);
      return { term, hits: 2 };
    },
  },
  {
    name: 'boom',
    description: 'always throws',
    run: async () => {
      throw new Error('kaputt');
    },
  },
];

// Scripted model: two lookups, one broken tool, one unknown action, repeat
// guard, then a final answer.
const script = [
  { thought: 'search first', action: 'lookup', args: { term: 'simap' } },
  { thought: 'same again', action: 'lookup', args: { term: 'simap' } },
  { thought: 'again', action: 'lookup', args: { term: 'simap' } },
  { __mixed: true },
  { __bare: true },
  { __noisy: true },
  { __many: true },
  { __array: true },
  { thought: 'try broken', action: 'boom', args: {} },
  { thought: 'nonsense', action: 'teleport', args: {} },
  { thought: 'done', final: 'two hits, one tool broken' },
];
let i = 0;
const ask = async () => {
  const entry = script[Math.min(i++, script.length - 1)];
  // A reply with two JSON objects back to back: the extractor can hand back an
  // inner blob without an action, the loop has to find the real call.
  if (entry.__mixed) {
    return {
      data: { query: 'binance' },
      text: '{"thought":"read it","action":"lookup","args":{"term":"recovered"}}{"thought":"and then',
    };
  }
  // A reply that is nothing but the arguments: only one tool takes "term".
  if (entry.__bare) return { data: { term: 'bare-call' } };
  // The arguments plus a key the model invented on the side.
  if (entry.__noisy) return { data: { term: 'noisy-call', limit: 5, reasoning: 'because' } };
  // Several calls in one reply: the first one counts.
  if (entry.__many) {
    const text = '{"term":"first-of-many"}{"term":"second-of-many"}{"term":"third-of-many"}';
    return { data: null, text };
  }
  // A reply that is a list of calls.
  if (entry.__array) return { data: [{ action: 'lookup', args: { term: 'from-array' } }] };
  return { data: entry };
};

const seen = [];
const { final, steps, observations } = await runAgent({
  system: 'test',
  task: 'test the loop',
  tools,
  maxSteps: 12,
  log: (l) => seen.push(l),
  ask,
});

const checks = {
  finished: final === 'two hits, one tool broken',
  steps: steps.length === 11,
  toolRan: calls.length === 7,
  recoveredCall: calls[2] === 'recovered',
  bareArgsCall: calls[3] === 'bare-call',
  noisyArgsCall: calls[4] === 'noisy-call',
  firstOfManyCall: calls[5] === 'first-of-many',
  arrayCall: calls[6] === 'from-array',
  repeatGuard: observations.some((o) => /same arguments 3 times/.test(o)),
  toolError: observations.some((o) => /kaputt/.test(o)),
  unknownAction: observations.some((o) => /unknown action/.test(o)),
  logged: seen.filter((l) => l.startsWith('AGENT')).length === 12,
  rawOnBadStep: seen.some((l) => /reply had no usable action/.test(l)),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok);
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error('\nobservations:\n' + observations.join('\n\n'));
  process.exit(1);
}
console.log('\nagent loop ok');
