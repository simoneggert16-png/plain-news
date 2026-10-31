// Which models answer right now, and how fast.
//
// Run from Actions (model probe) when the desk or the newsroom stops writing:
// a chain that used to work can lose every member at once — a monthly cap on
// one provider, a model retired or rate-limited on the other — and the logs
// then blame the work instead of the brain. Read-only, no content is written.

const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';

const CANDIDATES = (process.env.PROBE_MODELS || [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.1-405b-instruct',
  'deepseek-ai/deepseek-v3.1',
  'qwen/qwen3-235b-a22b',
  'moonshotai/kimi-k2-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  'google/gemma-3-27b-it',
].join(',')).split(',').map((s) => s.trim()).filter(Boolean);

const prompt = 'Reply with the single word: ready';

async function askNvidia(model, key) {
  const started = Date.now();
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 24, temperature: 0, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
    const ms = Date.now() - started;
    const body = await res.text();
    if (!res.ok) return { model, ok: false, status: res.status, ms, why: body.slice(0, 120) };
    const json = JSON.parse(body);
    const text = json.choices?.[0]?.message?.content || '';
    return { model, ok: Boolean(text.trim()), status: res.status, ms, text: text.trim().slice(0, 40) };
  } catch (err) {
    return { model, ok: false, ms: Date.now() - started, why: err.message };
  }
}

async function askOllama(model, key) {
  const started = Date.now();
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, think: false, options: { num_predict: 24 } }),
      signal: AbortSignal.timeout(60_000),
    });
    const ms = Date.now() - started;
    const body = await res.text();
    if (!res.ok) return { model: `ollama/${model}`, ok: false, status: res.status, ms, why: body.slice(0, 120) };
    const json = JSON.parse(body);
    const text = json.message?.content || '';
    return { model: `ollama/${model}`, ok: Boolean(text.trim()), status: res.status, ms, text: text.trim().slice(0, 40) };
  } catch (err) {
    return { model: `ollama/${model}`, ok: false, ms: Date.now() - started, why: err.message };
  }
}

async function listNvidia(key) {
  const res = await fetch(`${NVIDIA_BASE}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return `list failed: HTTP ${res.status}`;
  const json = await res.json();
  const ids = (json.data || []).map((m) => m.id);
  return `${ids.length} models; likely text models: ${ids.filter((id) => !/vision|vl|llava|vila|pixtral|intern|embed|rerank|guard|code|whisper|tts|audio|image/i.test(id)).slice(0, 60).join(', ')}`;
}

const nvidiaKey = process.env.NVIDIA_API_KEY;
const ollamaKey = process.env.OLLAMA_API_KEY;

if (nvidiaKey) {
  console.log(`NVIDIA ${await listNvidia(nvidiaKey)}`);
  for (const model of CANDIDATES) {
    const r = await askNvidia(model, nvidiaKey);
    console.log(`NVIDIA ${r.ok ? 'OK  ' : 'FAIL'} ${String(r.ms).padStart(6)}ms ${model}${r.status ? ` HTTP ${r.status}` : ''}${r.text ? ` — "${r.text}"` : r.why ? ` — ${r.why}` : ''}`);
  }
} else {
  console.log('NVIDIA_KEY missing');
}

if (ollamaKey) {
  for (const model of ['gpt-oss:120b', 'gemma4:31b', 'gpt-oss:20b']) {
    const r = await askOllama(model, ollamaKey);
    console.log(`OLLAMA ${r.ok ? 'OK  ' : 'FAIL'} ${String(r.ms).padStart(6)}ms ${r.model}${r.status ? ` HTTP ${r.status}` : ''}${r.text ? ` — "${r.text}"` : r.why ? ` — ${r.why}` : ''}`);
  }
} else {
  console.log('OLLAMA_KEY missing');
}
