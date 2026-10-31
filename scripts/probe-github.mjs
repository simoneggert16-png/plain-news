#!/usr/bin/env node
// Is GitHub Models usable as a provider from Actions? The job token carries
// `models: read`, so it needs no new secret. An earlier probe got the bare
// string "OK" with HTTP 200 for every call, which is a gateway answer, not a
// completion. This prints the status, the content type and the first bytes for
// the endpoint and the two model names that matter, so the next decision is
// based on what the server actually sends.
const TOKEN = process.env.GITHUB_TOKEN || '';
const BASES = [
  'https://models.github.ai/inference',
  'https://models.inference.ai.azure.com',
];
const MODELS = (process.env.PROBE_MODELS || 'openai/gpt-4o-mini,openai/gpt-4.1-mini,mistral-ai/mistral-small').split(',').map((s) => s.trim()).filter(Boolean);

if (!TOKEN) {
  console.log('GITHUB_TOKEN missing');
  process.exit(1);
}

for (const base of BASES) {
  for (const model of MODELS) {
    const started = Date.now();
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with exactly this JSON and nothing else: {"ok":true}' }],
          max_tokens: 40,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const raw = await res.text();
      const ms = Date.now() - started;
      let snippet = raw.replace(/\s+/g, ' ').slice(0, 160);
      try {
        const json = JSON.parse(raw);
        snippet = (json.choices?.[0]?.message?.content || JSON.stringify(json).slice(0, 160)).replace(/\s+/g, ' ');
      } catch {}
      console.log(`${base.split('//')[1].split('/')[0]} ${res.ok ? 'OK  ' : 'FAIL'} ${String(ms).padStart(6)}ms ${model} HTTP ${res.status} ${res.headers.get('content-type') || ''} — "${snippet}"`);
    } catch (e) {
      console.log(`${base.split('//')[1].split('/')[0]} FAIL ${String(Date.now() - started).padStart(6)}ms ${model} — ${e.message}`);
    }
  }
}
