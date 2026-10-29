#!/usr/bin/env node
// Free-model benchmark for the newsroom roles.
//
// Runs the production prompts against every model named on the command line
// and prints JSON validity, shape and latency, so the chains in bots/lib/llm.mjs
// can be re-tuned when Ollama adds or removes free models.
//
//   node scripts/bench-models.mjs
//   node scripts/bench-models.mjs --models=gpt-oss:120b,gemma4:31b --tasks=de,writer
//   node scripts/bench-models.mjs --slug=<article-slug> --locales=de,ja,ko
import fs from 'node:fs';
import path from 'node:path';
import { chatJSON } from '../bots/lib/llm.mjs';
import { STYLE_GUIDE } from '../bots/lib/style.mjs';
import { terminologyFor } from '../bots/lib/terminology.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
  })
);
const MODELS = String(args.models || 'gpt-oss:120b,gemma4:31b,gpt-oss:20b').split(',');
const TASKS = String(args.tasks || 'desk,writer,editor,de,ja').split(',');
const LOCALES = String(args.locales || 'de,ja').split(',');

function newestArticleWithBody() {
  const dir = 'content/articles';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  for (const f of files) {
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const en = a.locales?.en;
    if (en?.body?.length >= 4) return a;
  }
  throw new Error('no article with an English body found');
}

const article = args.slug
  ? JSON.parse(fs.readFileSync(`content/articles/${args.slug}.json`, 'utf8'))
  : newestArticleWithBody();
const en = article.locales.en;
const srcInput = { title: en.title, dek: en.dek, facts: en.facts || [], body: en.body, context: en.context || '', imageCaption: en.imageCaption || '' };

const sourcePack = [
  { outlet: article.sources?.[0]?.outlet || 'Source A', title: article.sources?.[0]?.title || en.title, text: en.body.slice(0, Math.ceil(en.body.length / 2)).join(' ') },
  { outlet: article.sources?.[1]?.outlet || 'Source B', title: article.sources?.[1]?.title || en.title, text: en.body.slice(Math.ceil(en.body.length / 2)).join(' ') },
].map((s, i) => `[S${i + 1}] ${s.outlet} — "${s.title}"\nURL: https://example.org/${i}\nTEXT: ${s.text}`).join('\n\n');

const SCHEMA = '{"title":"...","dek":"one-sentence summary, max 30 words","facts":["3-5 short key facts"],"body":["3-6 paragraphs, each 2-4 sentences"],"context":"1-3 sentences of neutral background","category":"politics|world|business|tech|science|climate|health|sport|culture","importance":3}';
const CATEGORIES = ['politics', 'world', 'business', 'tech', 'science', 'climate', 'health', 'sport', 'culture'];

const TASK_DEFS = {
  desk: () => ({
    messages: [
      { role: 'system', content: 'You are the news desk editor of an unbiased global news site. You group headlines into real-world EVENTS. Output ONLY a valid JSON object.' },
      {
        role: 'user',
        content: `Headlines (id|outlet|headline).\n0|Reuters|${en.title}\n1|${article.sources?.[1]?.outlet || 'AP'}|${article.sources?.[1]?.title || en.dek}\n2|DW|${en.title}\n3|AP|Stocks slip as chipmakers warn on demand\n4|CNBC|Nvidia shares fall after supplier guidance cut\n\nSOURCE RULES: two-source rule, category from ${CATEGORIES.join(', ')}.\nFormat: {"events":[{"ids":[0,2],"category":"world","importance":4,"event":"..."}]}`,
      },
    ],
    opts: { temperature: 0.1, maxTokens: 4096 },
  }),
  writer: () => ({
    messages: [
      { role: 'system', content: `You are a news reporter for an unbiased global news site.\n\n${STYLE_GUIDE}\n\nReply with JSON only.` },
      { role: 'user', content: `EVENT: ${en.dek}\n\nCATEGORY: ${article.category}\n\nSOURCES:\n${sourcePack}\n\nWrite the article in English using ONLY information from the sources.\nReturn exactly this JSON shape:\n${SCHEMA}` },
    ],
    opts: { temperature: 0.3, maxTokens: 12000 },
  }),
  editor: () => ({
    messages: [
      { role: 'system', content: `You are the standards editor of PLAIN. You are strict. You check drafts against the sources and the style guide.\n\n${STYLE_GUIDE}\n\nReply with JSON only.` },
      { role: 'user', content: `SOURCES:\n${sourcePack}\n\nDRAFT:\n${JSON.stringify(srcInput, null, 2)}\n\nCheck every sentence against the sources, fix unsupported claims and loaded language.\nReturn: {"verdict":"publish|revise|reject","problems":["..."],"article":${SCHEMA}}` },
    ],
    opts: { temperature: 0.1, maxTokens: 12000 },
  }),
};

for (const locale of LOCALES) {
  TASK_DEFS[locale] = () => ({
    messages: [
      { role: 'system', content: `You are a professional news translator. Translate into ${locale} in the neutral register of a quality newspaper. Keep meaning exact, same keys and same array lengths. Reply with JSON only.${terminologyFor(locale)}` },
      { role: 'user', content: JSON.stringify(srcInput) },
    ],
    opts: { temperature: 0.2, maxTokens: 10000 },
  });
}

function judge(task, data) {
  if (!data) return { json: 0, shape: 0 };
  if (task === 'desk') {
    const events = Array.isArray(data.events) ? data.events : [];
    const ok = events.length > 0 && events.every((e) => Array.isArray(e.ids) && e.category && e.event);
    return { json: 1, shape: ok ? 1 : 0, events: events.length };
  }
  if (task === 'writer') {
    const ok = typeof data.title === 'string' && data.title.length <= 95 && Array.isArray(data.body) && data.body.length >= 3 && Array.isArray(data.facts) && data.facts.length >= 3;
    return { json: 1, shape: ok ? 1 : 0, paragraphs: data.body?.length ?? 0 };
  }
  if (task === 'editor') {
    const ok = ['publish', 'revise', 'reject'].includes(data.verdict);
    return { json: 1, shape: ok ? 1 : 0, verdict: data.verdict };
  }
  const sameArrays = Array.isArray(data.body) && data.body.length === srcInput.body.length;
  const latin = !['zh', 'ja', 'ko'].includes(task);
  const words = JSON.stringify(data);
  const english = (words.match(/\b(the|and|of|to|in|is|that|with)\b/gi) || []).length;
  return {
    json: 1,
    shape: sameArrays ? 1 : 0,
    paragraphs: data.body?.length ?? 0,
    english: latin ? english : '-',
    germanTerms: task === 'de' ? (/Zwischenwahlen/i.test(words) ? 'ok' : '-') : '-',
  };
}

const rows = [];
for (const model of MODELS) {
  for (const task of TASKS) {
    const input = TASK_DEFS[task]();
    const models = [`${model.startsWith('ollama/') ? '' : 'ollama/'}${model}`];
    const t0 = Date.now();
    let data = null;
    let note = '';
    try {
      ({ data } = await chatJSON('translator', input.messages, { ...input.opts, models }));
    } catch (err) {
      note = err.message.slice(0, 60);
    }
    const row = { model, task, sec: +((Date.now() - t0) / 1000).toFixed(1), ...judge(task, data), note };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}

const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
console.log('\n' + cols.join('\t'));
for (const r of rows) console.log(cols.map((c) => r[c] ?? '').join('\t'));
