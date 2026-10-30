// A small ReAct loop for the desk.
//
// The newsroom bots are pipelines: fixed steps in, article out. The
// investigative desk works the other way round — it has to decide for itself
// what to look at next, follow a document to the next document, and stop when
// a question is answered. This loop gives the model that freedom with one
// constraint: it can only act through the tools it is handed, and every
// observation is real (a search result, a fetched page), never remembered.
import { chatJSON } from './llm.mjs';

const OBSERVATION_CHARS = 3200;
const REPEAT_LIMIT = 2;
// One slow site must not eat the run: every tool call gets a hard deadline.
const TOOL_TIMEOUT_MS = Number(process.env.AGENT_TOOL_TIMEOUT_MS || 90_000);
// Keys a model adds when it explains itself. They say nothing about which
// tool is meant, so they must not confuse the argument matching.
const NOISE_KEYS = new Set([
  'thought', 'reasoning', 'reason', 'why', 'explanation', 'note', 'notes',
  'comment', 'comments', 'limit', 'maxresults', 'max_results', 'count',
  'context', 'background', 'summary',
]);

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function toolDocs(tools) {
  return tools.map((t) => `- ${t.name}${t.args ? `(${t.args})` : ''}: ${t.description}`).join('\n');
}

function clip(value, chars = OBSERVATION_CHARS) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > chars ? `${text.slice(0, chars)}… [truncated]` : text;
}

const PROTOCOL = `PROTOCOL
Answer with exactly one JSON object per reply, nothing else.
To use a tool:
{"thought":"what I know so far and what I still need","action":"tool_name","args":{...}}
When the run is finished:
{"thought":"…","final":"what I found, what I could not find, what the next run should do"}
One action per reply. Never invent a URL, a figure, a name or a date: every URL must come from a tool observation, everything else from a page you opened. If a tool returns a warning, change approach instead of repeating the call.`;

// Free models sometimes emit two JSON objects back to back (a thought with a
// call, then a second call). The extracted object can then be an inner args
// blob with no action at all. Take the first complete object that is a call.
function firstCall(raw) {
  if (!raw) return null;
  let start = 0;
  while ((start = raw.indexOf('{', start)) !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = start; j < raw.length; j++) {
      const c = raw[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth) continue;
        try {
          const obj = JSON.parse(raw.slice(start, j + 1));
          if (obj && typeof obj === 'object' && (obj.action || obj.tool || obj.tool_name || obj.final)) return obj;
        } catch {}
        break;
      }
    }
    start++;
  }
  return null;
}

/**
 * The first complete JSON object in the text, whatever it contains.
 * A model that answers with several objects in a row means the first one.
 */
function firstObject(raw) {
  if (!raw) return null;
  let start = 0;
  while ((start = raw.indexOf('{', start)) !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = start; j < raw.length; j++) {
      const c = raw[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth) continue;
        try {
          const obj = JSON.parse(raw.slice(start, j + 1));
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
        } catch {}
        break;
      }
    }
    start++;
  }
  return null;
}

/**
 * Run the loop until the model finishes, the step budget is spent or the
 * deadline is close. `ask` is injectable so the loop can be tested without a
 * live model.
 */
export async function runAgent({
  role = 'desk',
  system,
  task,
  tools,
  maxSteps = 12,
  deadline = 0,
  reserveMs = 90_000,
  log = () => {},
  ask = chatJSON,
} = {}) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const observations = [];
  const history = [];
  const steps = [];
  const seen = new Map();
  let final = null;

  if (!tools?.length) throw new Error('runAgent needs at least one tool');

  const brief = `${task}

TOOLS
${toolDocs(tools)}

${PROTOCOL}`;

  for (let step = 1; step <= maxSteps; step++) {
    if (deadline && Date.now() > deadline - reserveMs) {
      log(`AGENT  stop at step ${step}: deadline close`);
      break;
    }

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: brief },
      // The model has to see its own earlier steps, otherwise it repeats
      // searches and forgets which document it already opened.
      ...history,
    ];

    const started = Date.now();
    let data;
    let raw = '';
    try {
      const reply = await ask(role, messages, { temperature: 0.2, maxTokens: 1200, timeoutMs: 75_000 });
      data = reply.data;
      raw = String(reply.text || '');
    } catch (err) {
      log(`AGENT  step ${step}: model failed — ${err.message}`);
      break;
    }

    if (typeof data === 'string') {
      // A reply that is nothing but a link means "open this", not "that is
      // the answer".
      data = /^https?:\/\/\S+$/i.test(data.trim()) ? { url: data.trim() } : { final: data };
    }
    // A model that answers with a list of calls means the first one.
    if (Array.isArray(data)) data = data[0] || null;
    // The reply did not parse into a call: take the first object in the text.
    const usable = data && typeof data === 'object' && (data.action || data.tool || data.tool_name || data.final);
    if (!usable) {
      const call = firstCall(raw);
      if (call) {
        data = call;
      } else {
        const first = firstObject(raw);
        if (first && (!data || typeof data !== 'object' || !Object.keys(data).length)) data = first;
      }
    }
    if (data?.final && !data.action && !data.tool) {
      final = String(data.final).slice(0, 2000);
      steps.push({ step, thought: String(data.thought || '').slice(0, 400), action: 'final', ms: Date.now() - started });
      log(`AGENT  step ${step}: final — ${final.slice(0, 160)}`);
      break;
    }

    // Some models answer with an action named "finish".
    if (['finish', 'done', 'stop'].includes(String(data?.action || data?.tool || '').trim().toLowerCase())) {
      final = String(data?.args?.final || data?.args?.text || data?.args?.summary || data?.thought || '').slice(0, 2000);
      steps.push({ step, thought: String(data?.thought || '').slice(0, 400), action: 'final', ms: Date.now() - started });
      log(`AGENT  step ${step}: final — ${final.slice(0, 160)}`);
      break;
    }

    // Free models drift between the shapes we ask for and the shapes they
    // learned; accept the usual aliases instead of failing the step.
    const call = data?.function && typeof data.function === 'object' ? data.function : data || {};
    let name = String(data?.action || data?.tool || data?.tool_name || call.name || data?.name || '').trim();
    // Some models answer with the bare arguments, no action at all. If exactly
    // one tool takes exactly those arguments, that is the call.
    if (!name && data && typeof data === 'object' && !Array.isArray(data)) {
      const keys = Object.keys(data).filter((k) => !NOISE_KEYS.has(k.toLowerCase()));
      const scored = tools.map((t) => {
        // Tool arg specs are written for the model ("{url: string}"), not for
        // JSON.parse, so read the keys loosely.
        let spec = [];
        try { spec = Object.keys(JSON.parse(t.args || '{}')); } catch {
          spec = [...String(t.args || '').matchAll(/["']?([a-zA-Z_]\w*)["']?\s*:/g)].map((m) => m[1]);
        }
        return {
          tool: t,
          matched: spec.filter((k) => keys.includes(k)).length,
          covered: keys.length > 0 && keys.every((k) => spec.includes(k)),
        };
      }).filter((x) => x.covered && x.matched > 0);
      scored.sort((a, b) => b.matched - a.matched);
      if (scored.length === 1 || (scored.length > 1 && scored[0].matched > scored[1].matched)) {
        name = scored[0].tool.name;
      }
    }
    // A model that replies with a link under an unexpected key still means
    // "open this".
    if (!name && data && typeof data === 'object' && !Array.isArray(data)) {
      const link = Object.values(data).find((v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim()));
      const opener = link && tools.find((t) => /["']?url["']?\s*:/.test(String(t.args || '')));
      if (opener) {
        name = opener.name;
        data = { ...data, url: link.trim() };
      }
    }
    const tool = byName.get(name);
    let rawArgs = data?.args ?? data?.arguments ?? data?.parameters ?? call.arguments ?? call.parameters ?? {};
    if (typeof rawArgs === 'string') {
      try { rawArgs = JSON.parse(rawArgs); } catch { rawArgs = {}; }
    }
    let args = rawArgs && typeof rawArgs === 'object' ? { ...rawArgs } : {};
    if (!Object.keys(args).length && data && typeof data === 'object' && !Array.isArray(data)) {
      // Some replies put the arguments next to the action: {"action":"open","url":"…"}
      const { thought, action, final, tool, tool_name, name, function: fn, ...rest } = data;
      args = rest;
    }
    // The explaining keys are not arguments.
    for (const key of Object.keys(args)) {
      if (NOISE_KEYS.has(key.toLowerCase())) delete args[key];
    }
    const thought = String(data?.thought || '').slice(0, 400);
    const key = `${name}:${JSON.stringify(args)}`;
    const repeats = (seen.get(key) || 0) + 1;
    seen.set(key, repeats);

    let result;
    if (!tool) {
      result = { error: `unknown action "${name}"`, tools: [...byName.keys()] };
      log(`AGENT  step ${step}: reply had no usable action — ${raw.replace(/\s+/g, ' ').slice(0, 200)}`);
    } else if (repeats > REPEAT_LIMIT) {
      result = { error: `you called ${name} with the same arguments ${repeats} times — choose a different action` };
    } else {
      try {
        result = await withTimeout(tool.run(args), TOOL_TIMEOUT_MS, name);
      } catch (err) {
        result = { error: String(err.message || err).slice(0, 300) };
      }
    }

    const observation = `OBSERVATION ${step} (${name || 'none'})\n${clip(result)}`;
    observations.push(observation);
    history.push({ role: 'assistant', content: JSON.stringify(data) });
    history.push({ role: 'user', content: observation });
    steps.push({
      step,
      thought,
      action: name || 'none',
      args,
      ok: !result?.error,
      ms: Date.now() - started,
    });
    log(`AGENT  step ${step}: ${name || '—'}${result?.error ? ` ✗ ${String(result.error).slice(0, 120)}` : ' ✓'} ${Math.round((Date.now() - started) / 100) / 10}s${thought ? ` — ${thought.replace(/\s+/g, ' ').slice(0, 110)}` : ''}`);
  }

  return { final, steps, observations };
}

export const __test = { clip, toolDocs, PROTOCOL, firstCall, firstObject };
