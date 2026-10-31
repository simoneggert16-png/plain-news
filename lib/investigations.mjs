// Shared rules for the investigative desk.
//
// The desk is deliberately small: readers may file a handful of wishes per
// week, the desk starts at most two of them, and nothing is published without
// a human signing off. Quality over throughput.
import { isCategory } from './config.mjs';

export const INVESTIGATION_QUOTAS = {
  wishesPerWeek: 10,       // accepted topic wishes across all readers per ISO week
  wishesPerReaderPerWeek: 2,
  newPerWeek: 2,           // dossiers the desk may open per week
  maxActive: 3,            // research + outreach + drafting at the same time
};

export const INVESTIGATION_STATUS = {
  pitch: 'pitch',           // selected, dossier skeleton
  research: 'research',
  outreach: 'outreach',     // waiting for replies to source requests
  drafting: 'drafting',
  review: 'review',         // written and verified, waiting for the editor
  approved: 'approved',     // human approval, next bot run publishes
  published: 'published',
  archived: 'archived',
  dropped: 'dropped',
};

export const REQUEST_STATUS = ['new', 'selected', 'declined', 'archived'];
export const OUTREACH_STATUS = ['requested', 'draft', 'approved', 'sent', 'replied', 'declined', 'failed', 'rejected'];

export const REQUEST_LIMITS = {
  topic: 160,
  why: 700,
  region: 80,
  hints: 700,
};

/** ISO year-week ("2026-W44"), the bucket for every weekly quota. */
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Trim, collapse whitespace, drop control characters, cap length. */
export function cleanField(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * One valid category out of what a model wrote. A model asked for one category
 * answered "politics|business" for two of the desk's first scan leads; the
 * site has one category per piece, and an invented one leaves the story in a
 * section nothing links to.
 */
export function pickCategory(value) {
  const token = String(value ?? '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .find((t) => isCategory(t));
  return token || 'world';
}

/** Validate a topic wish; returns { topic, why, region, hints } or throws. */
export function parseRequestInput(body) {
  const topic = cleanField(body?.topic, REQUEST_LIMITS.topic);
  if (topic.length < 8) throw new Error('Bitte beschreibe das Thema in mindestens acht Zeichen.');
  const why = cleanField(body?.why, REQUEST_LIMITS.why);
  const region = cleanField(body?.region, REQUEST_LIMITS.region);
  const hints = cleanField(body?.hints, REQUEST_LIMITS.hints);
  return { topic, why, region, hints };
}

export const isInvestigation = (entry) => entry?.form === 'investigation';
