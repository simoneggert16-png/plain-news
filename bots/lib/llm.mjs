// Minimal NVIDIA NIM client (OpenAI-compatible) with streaming, retries and model fallback.
const BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export const MODELS = {
  writer: [process.env.WRITER_MODEL, 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'deepseek-ai/deepseek-v4.1-flash'].filter(Boolean),
  editor: [process.env.EDITOR_MODEL, 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'z-ai/glm-5.3'].filter(Boolean),
  translator: [process.env.TRANSLATOR_MODEL, 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3.5-lightning-30b-a3b'].filter(Boolean),
  desk: [process.env.DESK_MODEL, 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3.5-lightning-30b-a3b'].filter(Boolean),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once(model, messages, { temperature = 0.2, maxTokens = 4096, timeoutMs = 90_000 } = {}) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error('NVIDIA_API_KEY missing');
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature, top_p: 0.9, max_tokens: maxTokens, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`${model} HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const choice = json.choices?.[0];
  const msg = choice?.message || {};
  // If msg.content exists and is non-empty, use that; otherwise fall back to reasoning_content
  let out = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning_content || '');
  // If content didn't have JSON but reasoning did (or vice versa), concatenate them
  if (msg.content && msg.reasoning_content && !msg.content.includes('{') && msg.reasoning_content.includes('{')) {
    out = msg.reasoning_content;
  }
  return out;
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
        if (e.status === 404 || e.status === 400 || e.status === 401 || e.status === 403) break; // try next model
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
      console.warn(`[chatJSON] attempt ${attempt + 1} parse failed (${e.message}). Raw output (first 300 chars):`, JSON.stringify(text.slice(0, 300)));
      messages = [
        ...messages,
        { role: 'assistant', content: text.slice(0, 1500) },
        { role: 'user', content: 'Your previous output did not contain valid parseable JSON. Output ONLY raw JSON now. Start with { or [ and end with } or ]. No explanations, no markdown.' },
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
