#!/usr/bin/env node
// Which switch stops a reasoning model from narrating instead of answering?
//
// 2026-11-01: minimax answered a sample headline in 40 s with five clean
// marker lines, and the article that failed in the run made it narrate for
// the whole 900-token budget ("We need produce exact five blocks ..."), so no
// marker ever arrived. The same request is sent here with every spelling of
// "do not think first" that the providers use; the answer shows which one is
// honoured (no narration, markers present, within a normal timeout).
//
//   PROBE_MODELS=minimaxai/minimax-m3.1-flash PROBE_SLUG=<slug> node scripts/probe-thinking.mjs
import fs from 'node:fs';
import { chat } from '../bots/lib/llm.mjs';
import { headMessages } from '../bots/lib/translate.mjs';

const models = (process.env.PROBE_MODELS || 'minimaxai/minimax-m3.1-flash').split(',').map((m) => m.trim()).filter(Boolean);
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS) || 120_000;
const maxTokens = Number(process.env.PROBE_MAX_TOKENS) || 900;

const slug = process.env.PROBE_SLUG || '';
const article = slug && fs.existsSync(`content/articles/${slug}.json`)
  ? JSON.parse(fs.readFileSync(`content/articles/${slug}.json`, 'utf8'))
  : null;
const src = article?.locales?.en || {
  title: 'COP17 Nations Agree on New Nature Targets, Finance Commitments',
  dek: 'Delegates in Cali closed the summit with a fund and a promise to protect thirty percent of land and sea by 2030.',
  facts: ['A fund of 200 billion dollars was agreed.', 'Thirty percent of land and sea is to be protected by 2030.'],
};

// reasoning_effort is the one spelling the provider honoured on 2026-11-01: the
// answer started with the marker instead of a plan. It arrived 15 characters
// long, so the budget is part of the question — each effort is tried with the
// room a full answer needs, and a plain request is the control.
const efforts = (process.env.PROBE_EFFORT || 'none,minimal,low').split(',').map((s) => s.trim()).filter(Boolean);
const variants = [
  ['plain', null],
  ...efforts.map((e) => [`reasoning_effort:${e}`, { reasoning_effort: e }]),
];

console.log(`article: ${article?.slug || '(sample)'}, ${src.facts?.length || 0} fact(s), maxTokens ${maxTokens}`);

for (const model of models) {
  for (const [label, extra] of variants) {
    const started = Date.now();
    try {
      const answer = await chat('translator', headMessages(src, 'de'), {
        models: [model],
        timeoutMs,
        maxTokens,
        temperature: 0.2,
        extra,
      });
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      const marks = (answer.text.match(/@@\s*(?:TITLE|DEK|FACTS|CONTEXT|CAPTION)\s*@@/gi) || []).length;
      const narrated = /^(we|the user|need|let me|i need|okay)/i.test(answer.text.trim());
      console.log(`\n${model} — ${label}: ${answer.doneReason || 'stop'} in ${seconds}s, ${answer.text.length} chars, ${marks} marker(s)${narrated ? ', narrates' : ''}`);
      console.log(answer.text.slice(0, 400).replace(/\s+/g, ' '));
    } catch (e) {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`\n${model} — ${label}: FAILED in ${seconds}s — ${String(e.message).slice(0, 160)}`);
    }
  }
}
