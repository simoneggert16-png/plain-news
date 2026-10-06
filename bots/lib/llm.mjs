// Minimal NVIDIA NIM client (OpenAI-compatible) with streaming, retries and model fallback.
const BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export const MODELS = {
  writer: [process.env.WRITER_MODEL, 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'deepseek-ai/deepseek-v4.1-flash'].filter(Boolean),
  editor: [process.env.EDITOR_MODEL, 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'z-ai/glm-5.3'].filter(Boolean),
  translator: [process.env.TRANSLATOR_MODEL, 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3.5-lightning-30b-a3b'].filter(Boolean),
  desk: [process.env.DESK_MODEL, 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3.5-lightning-30b-a3b'].filter(Boolean),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once(model, messages, { temperature = 0.2, maxTokens = 4096, timeoutMs = 240_000 } = {}) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error('NVIDIA_API_KEY missing');
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ model, messages, temperature, top_p: 0.9, max_tokens: maxTokens, stream: true }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`${model} HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  // Read SSE stream.
  const dec = new TextDecoder();
  let buf = '';
  let out = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const d = JSON.parse(data).choices?.[0]?.delta;
        if (d?.content) out += d.content;
      } catch { /* partial line */ }
    }
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
        await sleep(2000 * 2 ** attempt + Math.random() * 1000);
      }
    }
    console.warn(`  ↳ model ${model} failed: ${lastErr?.message}`);
  }
  throw lastErr;
}

/** Ask for JSON and parse robustly (strips <think>, code fences, prose). */
export async function chatJSON(role, messages, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, model } = await chat(role, messages, opts);
    try {
      return { data: extractJSON(text), model };
    } catch (e) {
      lastErr = e;
      messages = [...messages, { role: 'assistant', content: text.slice(0, 2000) }, { role: 'user', content: 'That was not valid JSON. Reply again with ONLY the JSON object, no prose, no code fences.' }];
    }
  }
  throw lastErr;
}

export function extractJSON(text) {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/[\[{]/);
  if (start < 0) throw new Error('No JSON found');
  const open = t[start];
  const close = open === '{' ? '}' : ']';
  const end = t.lastIndexOf(close);
  return JSON.parse(t.slice(start, end + 1));
}
