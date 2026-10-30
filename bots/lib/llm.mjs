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

async function callOllama(model, messages, { temperature = 0.2, maxTokens = 4096, timeoutMs = 90000 } = {}) {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error('OLLAMA_API_KEY missing');
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
      // Default num_ctx is small enough to cut long article bodies, and the
      // reply needs room for a full 9-language JSON block.
      options: { temperature, num_ctx: 32768, num_predict: maxTokens },
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Ollama ${model} HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const msg = json.message || {};
  return ((msg.content && msg.content.trim()) ? msg.content : (msg.thinking || '')).trim();
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
  return out.trim();
}

const disabledModels = new Map();

// A cycle may not run forever. The model list (4 models × 3 attempts × 120 s)
// allowed a single call to burn an hour, which is how the newsroom sat in one
// cycle for four hours without publishing. Callers set an absolute deadline;
// every attempt is cut at it.
let globalDeadline = 0;
export function setDeadline(ts) { globalDeadline = ts || 0; }
export function deadlineLeft() { return globalDeadline ? globalDeadline - Date.now() : Infinity; }

/** Chat with fallback across a list of models. Returns { text, model }. */
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
        const text = model.startsWith('ollama/')
          ? await callOllama(model.slice(7), messages, callOpts)
          : await callNvidia(model, messages, callOpts);
        if (!text.trim()) throw new Error(`${model} returned empty output`);
        return { text, model };
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
    const { text, model } = await chat(role, messages, opts);
    try {
      return { data: extractJSON(text), model, text };
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

export function extractJSON(text) {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
    t = fence[1].trim();
  }

  try { return JSON.parse(t); } catch {}

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
