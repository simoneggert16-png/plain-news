#!/usr/bin/env node
// What does a model actually answer to the real translation request?
//
// 2026-11-01: every German translation failed with "head returned no title",
// although the models answered in 30-100 s. The request asks for marker lines,
// not JSON. This probe sends the exact same messages translate.mjs sends and
// prints the whole answer, so the next change is made against an answer that
// exists instead of one that is guessed.
//
//   PROBE_MODELS=minimaxai/minimax-m3.1-flash,stepfun-ai/step-5-preview node scripts/probe-head.mjs
import { chat } from '../bots/lib/llm.mjs';
import { headMessages, bodyMessages } from '../bots/lib/translate.mjs';

const models = (process.env.PROBE_MODELS || 'minimaxai/minimax-m3.1-flash').split(',').map((m) => m.trim()).filter(Boolean);
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS) || 120_000;
const maxTokens = Number(process.env.PROBE_MAX_TOKENS) || 900;

const src = {
  title: 'COP17 Nations Agree on New Nature Targets, Finance Commitments',
  dek: 'Delegates in Cali closed the summit with a fund and a promise to protect thirty percent of land and sea by 2030.',
  facts: [
    'A fund of 200 billion dollars was agreed.',
    'Thirty percent of land and sea is to be protected by 2030.',
    'The summit ran two days past its scheduled end.',
    'Forest nations asked for payments for standing forest.',
  ],
  body: [
    'Delegates from 196 countries closed the COP17 summit in Cali on Friday with an agreement on new nature targets and a fund to pay for them.',
    'The fund, worth 200 billion dollars, is to be paid out over the next eight years. Forest nations had asked for payments for standing forest.',
    'Environmental groups called the result a compromise that leaves the hardest questions for the next summit in 2028.',
  ],
  context: '',
  imageCaption: '',
};

const cases = [
  ['head (markers)', headMessages(src, 'de')],
  ['body (markers)', bodyMessages(src, src.body, 'de')],
];

for (const model of models) {
  for (const [label, messages] of cases) {
    const started = Date.now();
    try {
      const answer = await chat('translator', messages, { models: [model], timeoutMs, maxTokens, temperature: 0.2 });
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`\n=== ${model} — ${label}: ${answer.doneReason || 'stop'} in ${seconds}s, ${answer.text.length} chars`);
      console.log(answer.text.slice(0, 1600));
    } catch (e) {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`\n=== ${model} — ${label}: FAILED in ${seconds}s — ${String(e.message).slice(0, 200)}`);
    }
  }
}
