// Which models answer right now, and how fast.
//
// Run from Actions (model probe) when the desk or the newsroom stops writing:
// a chain that used to work can lose every member at once — a monthly cap on
// one provider, a model retired or rate-limited on the other — and the logs
// then blame the work instead of the brain. Read-only, no content is written.

const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';
// GitHub Models needs no new key: the workflow token can ask, if the job is
// allowed `models: read`. It answers slowly and in small numbers, but a pixel
// of brain beats an eighteen-minute shift that cannot think at all.
const GITHUB_MODELS_BASE = process.env.GITHUB_MODELS_BASE_URL || 'https://models.github.ai/inference';
const GITHUB_CANDIDATES = (process.env.PROBE_GITHUB_MODELS || [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'meta/Llama-4-Scout-17B-16E-Instruct',
  'mistral-ai/mistral-small-2503',
].join(',')).split(',').map((s) => s.trim()).filter(Boolean);

const CANDIDATES = (process.env.PROBE_MODELS || [
  'openai/gpt-oss-20b',
  'deepseek-ai/deepseek-v4.1-flash',
  'z-ai/glm-5.3-flash',
  'minimaxai/minimax-m3.1-flash',
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'moonshotai/kimi-k2.6',
  'mistralai/mistral-large-4-1t-a52b',
  'mistralai/mistral-large-2-instruct',
  'google/gemma-4-31b-it',
  'google/gemma-3-12b-it',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'meta/muse-glimmer-30b',
  'stepfun-ai/step-5-preview',
].join(',')).split(',').map((s) => s.trim()).filter(Boolean);

// The desk does not ask for prose, it asks for a document. A model that
// cannot hold a JSON shape is no use however fast it answers.
const prompt = 'Reply with only this JSON and nothing else: {"ok":true,"word":"bereit"}';

async function askNvidia(model, key) {
  const started = Date.now();
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 96, temperature: 0, stream: false }),
      signal: AbortSignal.timeout(90_000),
    });
    const ms = Date.now() - started;
    const body = await res.text();
    if (!res.ok) return { model, ok: false, status: res.status, ms, why: body.slice(0, 120) };
    const json = JSON.parse(body);
    const choice = json.choices?.[0] || {};
    const text = choice.message?.content || choice.message?.reasoning_content || '';
    return { model, ok: Boolean(text.trim()), status: res.status, ms, text: text.trim().slice(0, 60), finish: choice.finish_reason };
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

async function askGithub(model, token) {
  const started = Date.now();
  try {
    const res = await fetch(`${GITHUB_MODELS_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 96, temperature: 0 }),
      signal: AbortSignal.timeout(60_000),
    });
    const ms = Date.now() - started;
    const body = await res.text();
    if (!res.ok) return { model, ok: false, status: res.status, ms, why: body.slice(0, 120) };
    const json = JSON.parse(body);
    const choice = json.choices?.[0] || {};
    const text = choice.message?.content || '';
    return { model, ok: Boolean(text.trim()), status: res.status, ms, text: text.trim().slice(0, 60), finish: choice.finish_reason };
  } catch (err) {
    return { model, ok: false, ms: Date.now() - started, why: err.message };
  }
}

const nvidiaKey = process.env.NVIDIA_API_KEY;
const ollamaKey = process.env.OLLAMA_API_KEY;
const githubToken = process.env.GITHUB_TOKEN;

if (nvidiaKey) {
  console.log(`NVIDIA ${await listNvidia(nvidiaKey)}`);
  for (const model of CANDIDATES) {
    const r = await askNvidia(model, nvidiaKey);
    console.log(`NVIDIA ${r.ok ? 'OK  ' : 'FAIL'} ${String(r.ms).padStart(6)}ms ${model}${r.status ? ` HTTP ${r.status}` : ''}${r.finish ? ` [${r.finish}]` : ''}${r.text ? ` — "${r.text}"` : r.why ? ` — ${r.why}` : ''}`);
  }
} else {
  console.log('NVIDIA_KEY missing');
}

if (ollamaKey) {
  // The 429 says "monthly limit"; only the balance endpoint says when it
  // lifts. On 2026-10-31 it was 2026-11-16T11:42Z — sixteen days in which no
  // Ollama model would answer, which no log line had said out loud.
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/balance`, { headers: { Authorization: `Bearer ${ollamaKey}` }, signal: AbortSignal.timeout(20_000) });
    const body = await res.json();
    const inc = body.included || {};
    const per = inc.period || {};
    console.log(`OLLAMA allowance ${inc.balance_usd}/${inc.allowance_usd} USD left, period ${per.from || '?'} to ${per.until || '?'}, purchased ${body.purchased?.balance_usd ?? 0}`);
  } catch (err) {
    console.log(`OLLAMA balance unavailable — ${err.message}`);
  }
  for (const model of ['gpt-oss:120b', 'gemma4:31b', 'gpt-oss:20b']) {
    const r = await askOllama(model, ollamaKey);
    console.log(`OLLAMA ${r.ok ? 'OK  ' : 'FAIL'} ${String(r.ms).padStart(6)}ms ${r.model}${r.status ? ` HTTP ${r.status}` : ''}${r.text ? ` — "${r.text}"` : r.why ? ` — ${r.why}` : ''}`);
  }
} else {
  console.log('OLLAMA_KEY missing');
}

if (githubToken) {
  for (const model of GITHUB_CANDIDATES) {
    const r = await askGithub(model, githubToken);
    console.log(`GITHUB ${r.ok ? 'OK  ' : 'FAIL'} ${String(r.ms).padStart(6)}ms ${model}${r.status ? ` HTTP ${r.status}` : ''}${r.finish ? ` [${r.finish}]` : ''}${r.text ? ` — "${r.text}"` : r.why ? ` — ${r.why}` : ''}`);
  }
} else {
  console.log('GITHUB_TOKEN missing');
}
