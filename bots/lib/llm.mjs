import fs from 'node:fs';

// Explicitly load .env file
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

// ─── Ollama Cloud first, NVIDIA as the last resort ─────────────────────────
// Benchmarked 2026-10-29 on the production prompts (scripts/bench-models.mjs):
//   translator, 24-paragraph longform, de/ja/fr:
//     gemma4:31b     8-9 s   same paragraph/number fidelity as 120B
//     gpt-oss:120b  14-19 s   cleanest phrasing, clearly slower
//     gpt-oss:20b   40-63 s   merges paragraphs now and then
//   desk/writer/editor: gpt-oss:120b writes the tightest English; gemma4 is
//     equally correct but thins out long drafts.
//   nemotron-3-super hallucinated terms, nemotron-3-ultra needs 2-3x the time,
//     beam sometimes answers the desk prompt with prose instead of JSON.
//   Ollama deepseek/glm/kimi/mistral -> 402, not on the free plan.
// On NVIDIA only gpt-oss-20b answers: super-120b/gemma-4-31b return 404.
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

const OSS_120B = 'ollama/gpt-oss:120b';
const GEMMA_31B = 'ollama/gemma4:31b';
const OSS_20B = 'ollama/gpt-oss:20b';
const NVIDIA_OSS_20B = 'openai/gpt-oss-20b';

// A model without a key is not a fallback, it is six seconds of retry sleep
// per call. Drop it from the chain up front.
const usable = (list) => list.filter((m) => m.startsWith('ollama/') || process.env.NVIDIA_API_KEY);

export const MODELS = {
  desk:       usable([process.env.DESK_MODEL || OSS_120B, GEMMA_31B, OSS_20B, NVIDIA_OSS_20B]),
  writer:     usable([process.env.WRITER_MODEL || OSS_120B, GEMMA_31B, OSS_20B, NVIDIA_OSS_20B]),
  // Translation is the highest-volume job: the fastest model that passes the
  // language/terminology gates wins, with 120B as the second opinion.
  translator: usable([process.env.TRANSLATOR_MODEL || GEMMA_31B, OSS_120B, OSS_20B, NVIDIA_OSS_20B]),
  editor:     usable([process.env.EDITOR_MODEL || OSS_120B, GEMMA_31B, NVIDIA_OSS_20B]),
  // Live ticker: small prompts every few minutes, still needs clean prose.
  live:       usable([process.env.LIVE_MODEL || GEMMA_31B, OSS_120B, OSS_20B, NVIDIA_OSS_20B]),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOllama(model, messages, { temperature = 0.2, maxTokens = 4096, timeoutMs = 90000, think = null, numCtx = 32768 } = {}) {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error('OLLAMA_API_KEY missing');
  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
    // Default num_ctx is small enough to cut long article bodies, and the
    // reply needs room for a full 9-language JSON block. The window holds
    // prompt and answer together: a long source pack plus a long piece
    // needs more than 32k, or the answer is cut off mid-sentence.
    options: { temperature, num_ctx: numCtx, num_predict: maxTokens },
    stream: false,
  };
  // Hybrid models spend their token budget on reasoning. A 4000-word piece
  // then arrives cut off with nothing but thinking in it. `think: false` tells
  // Ollama to answer straight away.
  if (think === false) body.think = false;

  const send = async () => {
    const doFetch = () => fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const res = await doFetch();
    if (res.ok || res.status !== 400) return res;
    // Older deployments do not know `think`, and some models do not take a
    // window this large. Ask again with the smaller settings before giving up.
    delete body.think;
    body.options.num_ctx = 32768;
    return doFetch();
  };

  const res = await send();
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const err = new Error(`Ollama ${model} HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const msg = json.message || {};
  const content = (msg.content || '').trim();
  const thinking = (msg.thinking || '').trim();
  // Reasoning without an answer is not an answer. Passing the thinking text on
  // only produced confusing "no valid JSON" failures further down.
  if (!content && thinking) {
    const err = new Error(`Ollama ${model} returned only reasoning (${thinking.length} characters), no answer`);
    err.status = res.status;
    throw err;
  }
  const out = (content || thinking).trim();
  // "length" means the model was cut off at the token limit. A long answer
  // that stops early is missing its last fields, and the caller has to know.
  return { text: out, doneReason: json.done_reason || null };
}

async function callNvidia(model, messages, { temperature = 0.2, maxTokens = 4096, timeoutMs = 120_000 } = {}) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error('NVIDIA_API_KEY missing');

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: 0.9,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Nvidia ${model} HTTP ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  const msg = choice?.message || {};

  // Nemotron 550B reasoning model: prefer content, fall back to reasoning_content
  let out = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning_content || '');
  if (msg.reasoning_content && msg.content && !msg.content.includes('{') && msg.reasoning_content.includes('{')) {
    out = msg.reasoning_content;
  }
  return { text: out.trim(), doneReason: choice?.finish_reason || null };
}

const disabledModels = new Map();

// A cycle may not run forever. The model list (4 models × 3 attempts × 120 s)
// allowed a single call to burn an hour, which is how the newsroom sat in one
// cycle for four hours without publishing. Callers set an absolute deadline;
// every attempt is cut at it.
let globalDeadline = 0;
export function setDeadline(ts) { globalDeadline = ts || 0; }
export function deadlineLeft() { return globalDeadline ? globalDeadline - Date.now() : Infinity; }

/** Chat with fallback across a list of models. Returns { text, model, doneReason }. */
export async function chat(role, messages, opts = {}) {
  const models = opts.models || MODELS[role] || [role];
  const deadline = opts.deadline || globalDeadline;
  let lastErr;
  const now = Date.now();

  for (const model of [...new Set(models)]) {
    if (disabledModels.has(model) && disabledModels.get(model) > now) {
      continue;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      if (deadline && Date.now() > deadline) {
        throw new Error(`deadline reached before ${model} answered`);
      }
      const remaining = deadline ? deadline - Date.now() : Infinity;
      const callOpts = Number.isFinite(remaining)
        ? { ...opts, timeoutMs: Math.max(5000, Math.min(opts.timeoutMs || 120_000, remaining)) }
        : opts;
      try {
        const answer = model.startsWith('ollama/')
          ? await callOllama(model.slice(7), messages, callOpts)
          : await callNvidia(model, messages, callOpts);
        if (!answer.text.trim()) throw new Error(`${model} returned empty output`);
        return { text: answer.text, model, doneReason: answer.doneReason || null };
      } catch (e) {
        lastErr = e;
        if (e.status === 402 || e.status === 401 || e.status === 403) {
          disabledModels.set(model, Date.now() + 15 * 60 * 1000);
          break;
        }
        if (e.status === 404 || e.status === 400) break;
        await sleep(2000 * (attempt + 1));
      }
    }
    console.warn(`  ↳ model ${model} failed: ${lastErr?.message}`);
  }
  throw lastErr || new Error(`no usable model for role ${role}`);
}

/** Ask for JSON and parse robustly (strips <think>, code fences, prose). */
export async function chatJSON(role, messages, opts = {}) {
  let lastErr;
  const deadline = opts.deadline || globalDeadline;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (deadline && Date.now() > deadline) {
      throw lastErr || new Error('deadline reached before a valid JSON answer arrived');
    }
    const { text, model, doneReason } = await chat(role, messages, opts);
    try {
      return { data: extractJSON(text), model, text, doneReason };
    } catch (e) {
      lastErr = e;
      messages = [
        ...messages,
        { role: 'assistant', content: text.slice(0, 1500) },
        { role: 'user', content: 'Output ONLY raw valid JSON starting with { and ending with }. No markdown, no explanations.' },
      ];
    }
  }
  throw lastErr;
}

/**
 * Rebuild a JSON document that was cut off mid-answer.
 * Scans for the last value that arrived complete, then closes every bracket
 * that was still open at that point.
 */
export function repairTruncatedJSON(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  const s = text.slice(start);

  const stack = [];
  let inString = false;
  let escaped = false;
  let lastEnd = -1;
  let lastClosers = '';

  const closersFor = (open) => (open === '{' ? '}' : ']');
  const snapshot = () => stack.map(closersFor).reverse().join('');

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') {
        inString = false;
        // A string followed by a colon is a key, anything else is a value.
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] !== ':') {
          lastEnd = i + 1;
          lastClosers = snapshot();
        }
      }
      continue;
    }

    if (ch === '"') { inString = true; continue; }

    if (ch === '{' || ch === '[') { stack.push(ch); continue; }

    if (ch === '}' || ch === ']') {
      if (stack.pop() === undefined) return null; // more closers than openers
      lastEnd = i + 1;
      lastClosers = snapshot();
      continue;
    }

    if (ch === ',' && stack.length > 0) {
      // A comma ends a scalar value: 123, true, null
      const before = s.slice(0, i).trimEnd();
      if (/[:]\s*(-?\d[\d.eE+-]*|true|false|null)$/.test(before)) {
        lastEnd = i;
        lastClosers = snapshot();
      }
    }
  }

  if (lastEnd === -1) return null;
  return s.slice(0, lastEnd) + lastClosers;
}

export function extractJSON(text) {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
    t = fence[1].trim();
  }

  try { return JSON.parse(t); } catch {}

  // The answer was cut off mid-structure. Cut it back to the last value that
  // arrived complete and close the open brackets - a half piece beats none.
  const repaired = repairTruncatedJSON(t);
  if (repaired) {
    try { return JSON.parse(repaired); } catch {}
  }

  let best = null;
  for (const openChar of ['{', '[']) {
    const closeChar = openChar === '{' ? '}' : ']';
    let startIdx = 0;
    while ((startIdx = t.indexOf(openChar, startIdx)) !== -1) {
      let endIdx = t.lastIndexOf(closeChar);
      while (endIdx > startIdx) {
        const candidate = t.slice(startIdx, endIdx + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (!best || candidate.length > best.raw.length) {
            best = { parsed, raw: candidate };
          }
          break;
        } catch {
          endIdx = t.lastIndexOf(closeChar, endIdx - 1);
        }
      }
      startIdx++;
    }
  }

  if (best) return best.parsed;
  throw new Error('No valid JSON could be extracted from response');
}
