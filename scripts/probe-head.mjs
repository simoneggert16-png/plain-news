#!/usr/bin/env node
// What in a translation request makes a model stop answering?
//
// By 2026-10-31 evening the catalogue answered every small question in
// seconds, at 20 words or 1 000, with a 40-token or a 900-token budget. The
// translation request still never returned. This walks the four differences
// between that request and the working ones: a system message, a system
// message with the glossary, a JSON body as the user message, and the whole
// thing asked for plain text instead of JSON.
//
//   PROBE_MODELS=minimaxai/minimax-m3.1-flash node scripts/probe-head.mjs
import { chat } from '../bots/lib/llm.mjs';
import { terminologyFor } from '../bots/lib/terminology.mjs';

const model = (process.env.PROBE_MODELS || 'minimaxai/minimax-m3.1-flash').split(',')[0].trim();
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS) || 60_000;

const register = 'You are a professional news translator. Translate into German (de-CH) in the neutral register of a quality newspaper. Keep meaning exact. Do not add or remove information. Answer with JSON only: no reasoning, no explanation, no markdown.';
const head = {
  title: 'COP17 Nations Agree on New Nature Targets, Finance Commitments',
  dek: 'Delegates in Cali closed the summit with a fund and a promise to protect thirty percent of land and sea by 2030.',
  facts: [
    'A fund of 200 billion dollars was agreed.',
    'Thirty percent of land and sea is to be protected by 2030.',
    'The summit ran two days past its scheduled end.',
    'Forest nations asked for payments for standing forest.',
    'The next summit is in 2028.',
  ],
  context: '',
  imageCaption: '',
};

const variants = [
  ['system + glossary + JSON body', [{ role: 'system', content: register + terminologyFor('de') }, { role: 'user', content: JSON.stringify(head) }]],
  ['system without glossary + JSON body', [{ role: 'system', content: register }, { role: 'user', content: JSON.stringify(head) }]],
  ['no system + JSON body', [{ role: 'user', content: JSON.stringify(head) }]],
  ['system + glossary + prose body', [
    { role: 'system', content: `${register} Translate the fields and return the same JSON keys.` },
    { role: 'user', content: `Title: ${head.title}\nStandfirst: ${head.dek}\nFacts:\n- ${head.facts.join('\n- ')}` },
  ]],
];

for (const [label, messages] of variants) {
  const started = Date.now();
  try {
    const answer = await chat('translator', messages, { models: [model], timeoutMs, maxTokens: 700, temperature: 0.2, think: false });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${label}: ok in ${seconds}s — ${String(answer.text).replace(/\s+/g, ' ').slice(0, 120)}`);
  } catch (e) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${label}: FAILED in ${seconds}s — ${String(e.message).slice(0, 100)}`);
  }
}
