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
    try {
      ({ data } = await ask(role, messages, { temperature: 0.2, maxTokens: 1200 }));
    } catch (err) {
      log(`AGENT  step ${step}: model failed — ${err.message}`);
      break;
    }

    if (typeof data === 'string') data = { final: data };
    if (data?.final && !data.action) {
      final = String(data.final).slice(0, 2000);
      steps.push({ step, thought: String(data.thought || '').slice(0, 400), action: 'final', ms: Date.now() - started });
      log(`AGENT  step ${step}: final — ${final.slice(0, 160)}`);
      break;
    }

    const name = String(data?.action || '').trim();
    const tool = byName.get(name);
    const args = data?.args && typeof data.args === 'object' ? data.args : {};
    const thought = String(data?.thought || '').slice(0, 400);
    const key = `${name}:${JSON.stringify(args)}`;
    const repeats = (seen.get(key) || 0) + 1;
    seen.set(key, repeats);

    let result;
    if (!tool) {
      result = { error: `unknown action "${name}"`, tools: [...byName.keys()] };
    } else if (repeats > REPEAT_LIMIT) {
      result = { error: `you called ${name} with the same arguments ${repeats} times — choose a different action` };
    } else {
      try {
        result = await tool.run(args);
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
    log(`AGENT  step ${step}: ${name || '—'}${result?.error ? ` ✗ ${String(result.error).slice(0, 120)}` : ' ✓'}`);
  }

  return { final, steps, observations };
}

export const __test = { clip, toolDocs, PROTOCOL };
