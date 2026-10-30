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
  { thought: 'try broken', action: 'boom', args: {} },
  { thought: 'nonsense', action: 'teleport', args: {} },
  { thought: 'done', final: 'two hits, one tool broken' },
];
let i = 0;
const ask = async () => ({ data: script[Math.min(i++, script.length - 1)] });

const seen = [];
const { final, steps, observations } = await runAgent({
  system: 'test',
  task: 'test the loop',
  tools,
  maxSteps: 10,
  log: (l) => seen.push(l),
  ask,
});

const checks = {
  finished: final === 'two hits, one tool broken',
  steps: steps.length === 6,
  toolRan: calls.length === 2,
  repeatGuard: observations.some((o) => /same arguments 3 times/.test(o)),
  toolError: observations.some((o) => /kaputt/.test(o)),
  unknownAction: observations.some((o) => /unknown action/.test(o)),
  logged: seen.filter((l) => l.startsWith('AGENT')).length === 7,
  rawOnBadStep: seen.some((l) => /reply had no usable action/.test(l)),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok);
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error('\nobservations:\n' + observations.join('\n\n'));
  process.exit(1);
}
console.log('\nagent loop ok');
