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

// ─── NVIDIA NIM Client — Primary LLM Provider ───────────────────────────────
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

// Nemotron 550B is the primary model for all roles
const NEMOTRON_550B  = 'nvidia/nemotron-3-ultra-550b-a55b';
// Fast fallback: Nemotron 70B or Llama-3.1 Nemotron 70B
const NEMOTRON_70B   = 'nvidia/llama-3.1-nemotron-70b-instruct';
// Lighter fallback: 51B instruct
const NEMOTRON_51B   = 'nvidia/llama-3.1-nemotron-51b-instruct';

export const MODELS = {
  // Fast headline clustering — use 70B for speed, 550B as fallback
  desk:       [process.env.DESK_MODEL       || NEMOTRON_550B, NEMOTRON_70B, NEMOTRON_51B],
  // In-depth neutral reporting & multilingual translation
  writer:     [process.env.WRITER_MODEL     || NEMOTRON_550B, NEMOTRON_70B],
  translator: [process.env.TRANSLATOR_MODEL || NEMOTRON_70B,  NEMOTRON_51B],
  // Independent standards editor & adversarial verification
  editor:     [process.env.EDITOR_MODEL     || NEMOTRON_550B, NEMOTRON_70B],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
        const text = await callNvidia(model, messages, opts);
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
