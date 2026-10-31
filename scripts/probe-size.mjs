#!/usr/bin/env node
// How big may a prompt get before a model stops answering?
//
// On 2026-10-31 every model answered a fifteen-token question in 3-16 s and
// none of them answered a 500-token translation request in 100-300 s. This
// asks the same model the same question at growing sizes, so the wall is a
// number instead of a theory.
//
//   PROBE_MODELS=mistralai/mistral-large-4-1t-a52b PROBE_SIZES=20,200,500 node scripts/probe-size.mjs
import { chat } from '../bots/lib/llm.mjs';

const model = (process.env.PROBE_MODELS || 'mistralai/mistral-large-4-1t-a52b').split(',')[0].trim();
const sizes = (process.env.PROBE_SIZES || '20,200,500,1000,2000').split(',').map((s) => Number(s.trim())).filter(Boolean);
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS) || 45_000;

// ~12 words per sentence keeps the arithmetic honest enough for a wall.
const sentence = 'The committee met on Monday and reviewed the budget line by line, the second time this month. ';

for (const words of sizes) {
  const padding = sentence.repeat(Math.max(0, Math.ceil((words - 15) / 15)));
  const content = `${padding}Reply with only this JSON and nothing else: {"ok":true}`;
  const started = Date.now();
  try {
    const answer = await chat('translator', [{ role: 'user', content }], { models: [model], timeoutMs, maxTokens: 40, temperature: 0 });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`SIZE ~${words} words: ok in ${seconds}s — ${answer.text.slice(0, 50).replace(/\s+/g, ' ')}`);
  } catch (e) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`SIZE ~${words} words: FAILED in ${seconds}s — ${String(e.message).slice(0, 100)}`);
  }
}
