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

// ─── NVIDIA-only pipeline (Ollama expired) ─────────────────────────────────
// Verified live on NVIDIA build key: 550b + super-120b + gpt-oss-20b + gemma-4-31b = 200 OK.
// NOT entitled on this key (404): nemotron-70b/51b/ultra-253b, mistral-large-2, kimi-k2.6.
// Too slow (timeout): deepseek-v4.1-flash, glm-5.3-flash via NVIDIA.
// (Ollama 'ollama/' routing kept below as fallback if resubscribed.)
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

// NVIDIA Build: Nemotron 550B primary, verified fallbacks only
const NEMOTRON_550B  = 'nvidia/nemotron-3-ultra-550b-a55b';
const NEMOTRON_120B  = 'nvidia/nemotron-3-super-120b-a12b';
const GPT_OSS_20B    = 'openai/gpt-oss-20b';
const GEMMA_31B      = 'google/gemma-4-31b-it';

export const MODELS = {
  // Live probe 2026-10-13 ~18:10 UTC: gpt-oss-20b = 1s, super-120b = instant,
  // gemma-4-31b = 35s, 550b = 503/timeout. 550B parked last, auto-rejoins when healthy.
  // Desk: fast + clean JSON first
  desk:       [process.env.DESK_MODEL || GPT_OSS_20B, NEMOTRON_120B, GEMMA_31B, NEMOTRON_550B],
  // Writer: best neutral reporting available right now
  writer:     [process.env.WRITER_MODEL || GPT_OSS_20B, GEMMA_31B, NEMOTRON_120B, NEMOTRON_550B],
  // Translator: small + fast first (9 languages per story)
  translator: [process.env.TRANSLATOR_MODEL || GPT_OSS_20B, GEMMA_31B, NEMOTRON_120B, NEMOTRON_550B],
  // Editor: adversarial check
  editor:     [process.env.EDITOR_MODEL || GPT_OSS_20B, GEMMA_31B, NEMOTRON_120B, NEMOTRON_550B],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOllama(model, messages, { temperature = 0.2, timeoutMs = 90000 } = {}) {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error('OLLAMA_API_KEY missing');
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
      options: { temperature },
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

/** Chat with fallback across a list of NVIDIA models. Returns { text, model }. */
export async function chat(role, messages, opts = {}) {
  const models = MODELS[role] || [role];
  let lastErr;
  const now = Date.now();

  for (const model of [...new Set(models)]) {
    if (disabledModels.has(model) && disabledModels.get(model) > now) {
      continue;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const text = model.startsWith('ollama/')
          ? await callOllama(model.slice(7), messages, opts)
          : await callNvidia(model, messages, opts);
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
  throw lastErr;
}

/** Ask for JSON and parse robustly (strips <think>, code fences, prose). */
export async function chatJSON(role, messages, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { text, model } = await chat(role, messages, opts);
    try {
      return { data: extractJSON(text), model };
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
