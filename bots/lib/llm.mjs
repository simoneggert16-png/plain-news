// Multi-Provider LLM Client: Ollama Cloud (DeepSeek v4.1 Flash, MiniMax M3) + NVIDIA NIM
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export const MODELS = {
  // Model 1: MiniMax M3 — Rapid clustering & multimodal vision
  desk: [process.env.DESK_MODEL, 'minimax-m3', 'glm-5.3-flash', 'deepseek-v4.1-flash'].filter(Boolean),
  // Model 2: DeepSeek v4.1 Flash — In-depth neutral reporting & multilingual translation
  writer: [process.env.WRITER_MODEL, 'deepseek-v4.1-flash', 'glm-5.3-flash', 'minimax-m3'].filter(Boolean),
  translator: [process.env.TRANSLATOR_MODEL, 'deepseek-v4.1-flash', 'glm-5.3-flash', 'minimax-m3'].filter(Boolean),
  // Model 3: GLM-5.3 Flash — Independent standards editor & adversarial Gegenprüfung (fact-checking)
  editor: [process.env.EDITOR_MODEL, 'glm-5.3-flash', 'deepseek-v4.1-flash', 'minimax-m3'].filter(Boolean),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOllama(model, messages, { temperature = 0.2, timeoutMs = 60_000 } = {}) {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error('OLLAMA_API_KEY missing');

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
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
  return (msg.content && msg.content.trim()) ? msg.content : (msg.thinking || '');
}

async function callNvidia(model, messages, { temperature = 0.2, maxTokens = 4096, timeoutMs = 90_000 } = {}) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error('NVIDIA_API_KEY missing');

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature, top_p: 0.9, max_tokens: maxTokens, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Nvidia ${model} HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  const msg = choice?.message || {};
  let out = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning_content || '');
  if (msg.content && msg.reasoning_content && !msg.content.includes('{') && msg.reasoning_content.includes('{')) {
    out = msg.reasoning_content;
  }
  return out;
}

async function once(model, messages, opts = {}) {
  if (model.startsWith('deepseek') || model.startsWith('minimax') || model.startsWith('glm') || model.startsWith('kimi') || model.startsWith('gemma') || model.startsWith('gpt-oss') || model.startsWith('nemotron')) {
    return callOllama(model, messages, opts);
  }
  return callNvidia(model, messages, opts);
}

/** Chat with fallback across a list of models. Returns { text, model }. */
export async function chat(role, messages, opts = {}) {
  const models = MODELS[role] || [role];
  let lastErr;
  for (const model of [...new Set(models)]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const text = await once(model, messages, opts);
        if (!text.trim()) throw new Error(`${model} returned empty output`);
        return { text, model };
      } catch (e) {
        lastErr = e;
        if (e.status === 404 || e.status === 400 || e.status === 401 || e.status === 402 || e.status === 403) break;
        await sleep(1500 * (attempt + 1));
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
