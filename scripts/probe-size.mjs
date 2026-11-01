#!/usr/bin/env node
// How big may a prompt get before a model stops answering, and how fast does
// it write an answer?
//
// On 2026-10-31 every model answered a fifteen-token question in 3-16 s, a
// 500-word question in 2 s, and none of them returned a 300-token translation
// within 100 s. With PROBE_MAX_TOKENS=40,200,600 this measures the second half
// of that: whether the time goes into the answer or into the waiting.
//
//   PROBE_MODELS=minimaxai/minimax-m3.1-flash PROBE_SIZES=20,500 node scripts/probe-size.mjs
//   PROBE_MODELS=minimaxai/minimax-m3.1-flash PROBE_MAX_TOKENS=40,200,600 node scripts/probe-size.mjs
import { chat } from '../bots/lib/llm.mjs';

const model = (process.env.PROBE_MODELS || 'mistralai/mistral-large-4-1t-a52b').split(',')[0].trim();
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS) || 45_000;

// ~12 words per sentence keeps the arithmetic honest enough for a wall.
const sentence = 'The committee met on Monday and reviewed the budget line by line, the second time this month. ';

async function ask(label, words, maxTokens) {
  const padding = sentence.repeat(Math.max(0, Math.ceil((words - 15) / 15)));
  const content = `${padding}Reply with only this JSON and nothing else: {"ok":true}`;
  const started = Date.now();
  try {
    const answer = await chat('translator', [{ role: 'user', content }], { models: [model], timeoutMs, maxTokens, temperature: 0 });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const text = String(answer.text || '').replace(/\s+/g, ' ');
    console.log(`${label}: ok in ${seconds}s, ${text.length} chars — ${text.slice(0, 60)}`);
  } catch (e) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${label}: FAILED in ${seconds}s — ${String(e.message).slice(0, 100)}`);
  }
}

const budgets = (process.env.PROBE_MAX_TOKENS || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
if (budgets.length) {
  for (const budget of budgets) await ask(`BUDGET ${budget} tokens, 20-word prompt`, 20, budget);
} else {
  const sizes = (process.env.PROBE_SIZES || '20,200,500,1000,2000').split(',').map((s) => Number(s.trim())).filter(Boolean);
  for (const words of sizes) await ask(`SIZE ~${words} words`, words, 40);
}
