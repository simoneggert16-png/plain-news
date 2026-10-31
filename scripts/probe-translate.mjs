#!/usr/bin/env node
// Times one real translation through the live chain. The model probe says
// which models answer a five-token question; this says whether one of them can
// produce a whole article in German and how long it takes.
//
//   PROBE_SLUG=<slug> PROBE_LOCALES=de,fr node scripts/probe-translate.mjs
import { loadArticle } from '../bots/lib/store.mjs';
import { translate } from '../bots/lib/translate.mjs';
import { setDeadline } from '../bots/lib/llm.mjs';

const slug = process.env.PROBE_SLUG || 'iran-s-supreme-leader-warns-u-s-israel-of-20261031-k3p4';
const locales = (process.env.PROBE_LOCALES || 'de').split(',').map((s) => s.trim()).filter(Boolean);
// One model at a time when the question is "can this model do a whole
// article"; the full chain when the question is "will tonight's run work".
const models = (process.env.PROBE_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean);
const budget = Number(process.env.PROBE_BUDGET_MS) || 300_000;

const article = loadArticle(slug);
if (!article) {
  console.log(`no article ${slug}`);
  process.exit(1);
}
const source = article.locales?.en;
if (!source?.title) {
  console.log(`${slug} has no English text`);
  process.exit(1);
}
console.log(`source: "${source.title}" body ${String(source.body || '').length} chars, locales ${locales.join(',')}, models ${models.join(',') || 'the whole chain'}`);

for (const locale of locales) {
  setDeadline(Date.now() + budget);
  const started = Date.now();
  try {
    const out = await translate(source, locale, models);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${locale}: ok in ${seconds}s — "${String(out.title).slice(0, 70)}", body ${String(out.body || '').length} chars`);
  } catch (err) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${locale}: FAILED in ${seconds}s — ${err.message}`);
  }
}
