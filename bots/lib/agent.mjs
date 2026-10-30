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

/** The argument names a tool takes. The specs are written for the model, not
 * for JSON.parse, so the keys are read loosely. */
function toolSpec(tool) {
  try {
    return Object.keys(JSON.parse(tool?.args || '{}'));
  } catch {
    return [...String(tool?.args || '').matchAll(/["']?([a-zA-Z_]\w*)["']?\s*:/g)].map((m) => m[1]);
  }
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

// Free models drift between the shapes we ask for and the shapes they
// learned; accept the usual aliases instead of failing the step.
const ALIASES = {
  find: 'search', lookup: 'search', query: 'search', websearch: 'search', google: 'search',
  read: 'open', browse: 'open', view: 'open', fetch: 'open', page: 'open', url: 'open',
  source: 'save_source', savesource: 'save_source', addsource: 'save_source', cite: 'save_source',
  claim: 'save_claim', saveclaim: 'save_claim', addclaim: 'save_claim', fact: 'save_claim',
  gap: 'add_gap', addgap: 'add_gap', question: 'add_gap',
  contacts: 'contact', addcontact: 'contact', source_contact: 'contact',
  findcontact: 'find_contact', find_contact_address: 'find_contact', email: 'find_contact',
};

const flatName = (name) => String(name || '').toLowerCase().replace(/[\s_-]/g, '');

function aliasFor(name) {
  const alias = ALIASES[flatName(name)];
  return alias || null;
}

/**
 * A reply that names the tool as its key: {"open": {"url": "…"}}.
 * The model learned this shape from the function calling it has seen before,
 * and it is a call all the same. The desk must not lose a shift over the
 * difference between asking and doing.
 */
function toolKeyedCall(data, byName) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  for (const [key, value] of Object.entries(data)) {
    if (NOISE_KEYS.has(key.toLowerCase())) continue;
    const alias = aliasFor(key);
    const tool =
      byName.get(key) ||
      (alias && byName.get(alias)) ||
      byName.get(flatName(key));
    if (!tool) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { name: tool.name, args: { ...value } };
    }
    if (typeof value === 'string' && value.trim()) {
      const spec = toolSpec(tool);
      const text = value.trim();
      if (spec.length === 1) return { name: tool.name, args: { [spec[0]]: text } };
      if (/^https?:\/\//i.test(text) && spec.includes('url')) {
        return { name: tool.name, args: { url: text } };
      }
    }
  }
  return null;
}

/**
 * The tool whose own arguments are the reply: {"query": "…"}.
 * Some models answer with the arguments alone; if exactly one tool takes
 * exactly those arguments, that is the call.
 */
function toolFromArgs(data, tools) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const keys = Object.keys(data).filter((k) => !NOISE_KEYS.has(k.toLowerCase()));
  if (!keys.length) return null;
  const scored = tools.map((t) => {
    // Tool arg specs are written for the model ("{url: string}"), not for
    // JSON.parse, so read the keys loosely.
    const spec = toolSpec(t);
    const present = spec.filter((k) => keys.includes(k));
    return {
      tool: t,
      matched: present.length,
      covered: keys.every((k) => spec.includes(k)),
      // The reply may carry a flag on top of the arguments ("open": true).
      // A tool whose own arguments are all there is usable anyway.
      complete: spec.length > 0 && present.length === spec.length,
    };
  });
  const exact = scored.filter((x) => x.covered && x.matched > 0);
  const usable = scored.filter((x) => x.complete && x.matched > 0);
  const pool = exact.length ? exact : usable;
  pool.sort((a, b) => b.matched - a.matched);
  if (pool.length === 1 || (pool.length > 1 && pool[0].matched > pool[1].matched)) return pool[0].tool.name;
  return null;
}

/** The first link in the reply, also inside an object. */
function firstLink(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const flat = [];
  for (const v of Object.values(data)) {
    if (typeof v === 'string') flat.push(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const inner of Object.values(v)) if (typeof inner === 'string') flat.push(inner);
    }
  }
  return flat.find((v) => /^https?:\/\/\S+$/i.test(v.trim())) || null;
}

/** Does this object name a tool at all? */
function namesTool(data, byName, tools) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  for (const key of ['action', 'tool', 'tool_name', 'name']) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return true;
    if (v && typeof v === 'object' && typeof v.name === 'string' && v.name.trim()) return true;
  }
  if (toolKeyedCall(data, byName)) return true;
  if (toolFromArgs(data, tools)) return true;
  const link = firstLink(data);
  return Boolean(link) && tools.some((t) => /["']?url["']?\s*:/.test(String(t.args || '')));
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
  const cache = new Map();
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
      // The call often hides behind the prose ("…Let's try open. {…}"), and the
      // object that names a tool wins over the one that only explains.
      const alternatives = [firstCall(raw), firstObject(raw)].filter((c) => c && typeof c === 'object');
      const named = alternatives.find((c) => namesTool(c, byName, tools));
      if (named) data = named;
      else if (!data || !Object.keys(data).length) {
        const first = alternatives[0];
        if (first) data = first;
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
    const call =
      data?.function && typeof data.function === 'object'
        ? data.function
        : data?.tool && typeof data.tool === 'object'
          ? data.tool
          : data || {};
    let name = '';
    if (typeof data?.action === 'string') name = data.action.trim();
    else if (typeof data?.tool === 'string') name = data.tool.trim();
    else if (typeof data?.tool_name === 'string') name = data.tool_name.trim();
    else if (typeof call?.name === 'string') name = call.name.trim();
    else if (typeof data?.name === 'string') name = data.name.trim();
    // The tool named by its own key, with the arguments inside.
    let keyedArgs = null;
    if (!name) {
      const keyed = toolKeyedCall(data, byName);
      if (keyed) {
        name = keyed.name;
        keyedArgs = keyed.args;
      }
    }
    // The same drift in the action name itself. "find" means "search" here.
    if (name && !byName.has(name)) {
      const alias = aliasFor(name);
      if (alias && byName.has(alias)) name = alias;
    }
    // Some models answer with the bare arguments, no action at all. If exactly
    // one tool takes exactly those arguments, that is the call.
    if (!name) {
      const guess = toolFromArgs(data, tools);
      if (guess) name = guess;
    }
    // A model that replies with a link under an unexpected key still means
    // "open this".
    if (!name && data && typeof data === 'object' && !Array.isArray(data)) {
      const link = firstLink(data);
      const opener = link && tools.find((t) => /["']?url["']?\s*:/.test(String(t.args || '')));
      if (opener) {
        name = opener.name;
        keyedArgs = { url: link.trim() };
      }
    }
    const tool = byName.get(name);
    let rawArgs = keyedArgs ?? data?.args ?? data?.arguments ?? data?.parameters ?? call.arguments ?? call.parameters ?? {};
    if (typeof rawArgs === 'string') {
      try { rawArgs = JSON.parse(rawArgs); } catch { rawArgs = {}; }
    }
    let args = rawArgs && typeof rawArgs === 'object' ? { ...rawArgs } : {};
    if (!keyedArgs && !Object.keys(args).length && data && typeof data === 'object' && !Array.isArray(data)) {
      // Some replies put the arguments next to the action: {"action":"open","url":"…"}
      const { thought, action, final, tool, tool_name, name, function: fn, ...rest } = data;
      args = rest;
    }
    // The explaining keys are not arguments, and neither are the flags a model
    // puts next to them ("open": true).
    const spec = tool ? toolSpec(tool) : [];
    for (const key of Object.keys(args)) {
      if (NOISE_KEYS.has(key.toLowerCase())) { delete args[key]; continue; }
      if (typeof args[key] === 'boolean' && !spec.includes(key)) delete args[key];
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
    } else if (repeats > 1 && cache.has(key)) {
      // The same question twice. Hand back what the desk already has, with a
      // word to change course: a flat refusal teaches the model nothing and
      // costs the shift a minute it cannot get back.
      const cached = cache.get(key);
      const note = 'you already asked that — this is the answer you got. Open one of the results, or ask a different question.';
      result = cached && typeof cached === 'object' && !Array.isArray(cached)
        ? { ...cached, note }
        : { result: cached, note };
    } else {
      try {
        result = await withTimeout(tool.run(args), TOOL_TIMEOUT_MS, name);
      } catch (err) {
        result = { error: String(err.message || err).slice(0, 300) };
      }
      if (!result?.error) cache.set(key, result);
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

export const __test = { clip, toolDocs, PROTOCOL, firstCall, firstObject, toolFromArgs, namesTool };
