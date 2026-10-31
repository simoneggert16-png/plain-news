#!/usr/bin/env node
// PLAIN. INVESTIGATIVE DESK
//
// One dossier can run for months. Every run advances it by one small step:
//
//   INTAKE    Monday: pick at most two reader wishes (or a topic the desk finds
//             itself) — out of at most ten wishes per week.
//   RESEARCH  search, read, extract claims with a source for each, list gaps
//   OUTREACH  draft questions to the institutions involved; a human approves
//             every email before it leaves. Replies land back in the dossier.
//   WRITE     only when the material holds: enough independent sources, enough
//             verified claims, and a right of reply that was actually granted
//             time. Then a deep piece, verified claim by claim.
//   REVIEW    a human editor approves. Nothing publishes without that.
//
// State lives in content/investigations/<slug>.json (git), mirrored into
// Supabase for the admin UI and the reader pages.
import fs from 'node:fs';
import path from 'node:path';

if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
}

import { chatJSON, setDeadline, deadlineLeft } from './lib/llm.mjs';
import { fetchFeeds, fetchArticleDetails } from './lib/feeds.mjs';
import { DESK_FEEDS } from './sources.mjs';
import { googleNews, bingNews, webSearch, wideSearch, documentSearch, archivedCopy, NEWS_EDITIONS } from './lib/search.mjs';
import { filingCabinets, pressAddressFor, publishedEmail, cabinetFrontPage } from './lib/lookup.mjs';
import { institutionalDocuments, namedTerms, BOILERPLATE } from './lib/documents.mjs';
import { openPage } from './lib/browse.mjs';
import { runAgent } from './lib/agent.mjs';
import { STYLE_GUIDE, slopHits, styleProblems } from './lib/style.mjs';
import { collectImages, assignImages } from './lib/illustrate.mjs';
import { loadIndex, saveIndex, saveArticle, toIndexEntry, slugify } from './lib/store.mjs';
import { distinctOutlets, isPrimaryOutlet } from '../lib/editorial.mjs';
import { LOCALES, SOURCE_LOCALE, SITE } from '../lib/config.mjs';
import { terminologyFor } from './lib/terminology.mjs';
import { INVESTIGATION_QUOTAS, weekKey, pickCategory } from '../lib/investigations.mjs';
import {
  addOutreach,
  getInvestigationStatus,
  listOutreach,
  listRequests,
  requestOutreach,
  setInvestigationStatus,
  setOutreach,
  setRequestStatus,
  upsertInvestigation,
} from '../lib/investigationStore.mjs';
import { listMessages, markMessages, recordInbound } from '../lib/inboxStore.mjs';
import { fetchMail, slugFromAddress } from './lib/mailbox.mjs';
import { applyRightOfReply, INVENTED_REPLY, rightOfReplyLog } from './lib/rightOfReply.mjs';

// ─────────────────────────── config ───────────────────────────
const DOSSIER_DIR = 'content/investigations';
const STATE_FILE = path.join(DOSSIER_DIR, 'state.json');
// The tips people wrote to the desk. Their file is private and never part of
// the public repository, the way the mailbox itself is not.
const LEADS_FILE = path.join(DOSSIER_DIR, 'leads.json');
const DRY_RUN = process.env.INVESTIGATE_DRY_RUN === '1';
const FORCE_SLUG = String(process.env.INVESTIGATE_SLUG || '').trim();
// The editor approves a piece from the desk page. While the database is
// unreachable there is nowhere else to write that decision down, so the
// approval comes in with the run and goes into the dossier file.
const APPROVE_SLUG = String(process.env.INVESTIGATE_APPROVE || '').trim();
const APPROVED_BY = String(process.env.INVESTIGATE_APPROVED_BY || 'editor').trim();
// A letter is freed the same way a piece is: the editor decides, and the
// decision travels with the run when the shared shelf does not answer.
// Format: <slug>:<letter ids, comma separated>.
const APPROVE_LETTERS = String(process.env.INVESTIGATE_APPROVE_OUTREACH || '').trim();
const REJECT_LETTERS = String(process.env.INVESTIGATE_REJECT_OUTREACH || '').trim();
const CAN_SEND = !DRY_RUN && (process.env.GITHUB_ACTIONS === 'true' || process.env.INVESTIGATE_SEND === '1');
const MIN_SOURCES = Math.max(4, +(process.env.INVESTIGATE_MIN_SOURCES || 8));
const MIN_PRIMARY = Math.max(0, +(process.env.INVESTIGATE_MIN_PRIMARY || 2));
const MIN_CLAIMS = Math.max(3, +(process.env.INVESTIGATE_MIN_CLAIMS || 6));
const MIN_WORDS = Math.max(1200, +(process.env.INVESTIGATE_MIN_WORDS || 2500));
const REPLY_HOURS = Math.max(24, +(process.env.INVESTIGATE_REPLY_HOURS || 72));
const MAX_READS = Math.max(2, +(process.env.INVESTIGATE_MAX_READS || 6));
const MAX_SOURCE_CHARS = 6000;
const TRANSLATE_CONCURRENCY = Math.max(1, +(process.env.INVESTIGATE_TRANSLATE_CONCURRENCY || 3));
const TRANSLATE_LOCALES = String(process.env.INVESTIGATE_LOCALES || 'en,de,fr,es,it,pt')
  .split(',').map((s) => s.trim()).filter((c) => LOCALES.some((l) => l.code === c));
const EDITORIAL_EMAIL = process.env.INVESTIGATE_REPLY_TO || process.env.EDITORIAL_EMAIL || process.env.RESEND_FROM_EMAIL || 'simoneggert16@gmail.com';

// The desk answers under its own threaded address, so a reply lands on the
// right dossier instead of in the general editorial inbox.
const deskAddress = (slug) => (process.env.DESK_EMAIL_DOMAIN ? `desk+${slug}@${process.env.DESK_EMAIL_DOMAIN}` : EDITORIAL_EMAIL);

/**
 * True when a mail is addressed to the desk. The desk may share a mailbox
 * with the person who owns the paper, and only the desk's own mail is the
 * desk's business.
 */
function addressedToDesk(address) {
  const raw = String(address || '').toLowerCase();
  if (!raw) return false;
  const domain = String(process.env.DESK_EMAIL_DOMAIN || '').trim().toLowerCase();
  if (domain && !raw.includes(`@${domain}`)) return false;
  // The desk writes from one address and reads at another. An answer that
  // comes back to the sending address is still the desk's mail.
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim().toLowerCase();
  if (from && raw.includes(from)) return true;
  return /desk(\+[a-z0-9-]+)?@/.test(raw);
}
const ACTIVE_STATUSES = ['pitch', 'research', 'outreach', 'drafting', 'review', 'approved'];

setDeadline(Date.now() + Math.max(10, +(process.env.INVESTIGATE_MINUTES || 50)) * 60000);

const nowISO = () => new Date().toISOString();
const log = (...a) => process.stdout.write(`${nowISO().slice(11, 19)} ${a.join(' ')}\n`);
const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const ageHours = (iso) => Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600e3);
const isActive = (d) => ACTIVE_STATUSES.includes(d.status);

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch((e) => ({ error: e })); }
  }));
  return out;
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    log(`  ! ${err.message}`);
    return fallback;
  }
}

// A stalled call must not eat the shift. The promise keeps running in the
// background; the desk simply moves on.
function withDeadline(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} did not answer within ${Math.round(ms / 1000)}s`)), ms)),
  ]);
}

// Google News refuses most datacenter requests, so the search feeds come back
// nearly empty on GitHub runners. The desk's own watchlist of world outlets and
// primary sources is always read in addition.
const HOME_FEEDS = DESK_FEEDS;

// ─────────────────────────── dossier storage ───────────────────────────
function loadDossiers() {
  if (!fs.existsSync(DOSSIER_DIR)) return [];
  return fs.readdirSync(DOSSIER_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'state.json' && f !== 'index.json')
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(DOSSIER_DIR, f), 'utf8')); } catch { return null; }
    })
    // Only a dossier is a dossier. The folder also holds the desk's mailbox.
    .filter((d) => d && d.slug && d.title);
}

function saveDossier(d) {
  d.updatedAt = nowISO();
  fs.mkdirSync(DOSSIER_DIR, { recursive: true });
  fs.writeFileSync(path.join(DOSSIER_DIR, `${d.slug}.json`), `${JSON.stringify(d, null, 2)}\n`);
}

function loadState() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { s = {}; }
  // The tips people wrote to the desk are what they wrote, in their words.
  // They live in their own file, outside the public repository.
  const private_ = loadPrivateLeads();
  if (private_.length) s.leads = [...private_, ...(Array.isArray(s.leads) ? s.leads : [])];
  return s;
}

function saveState(s) {
  fs.mkdirSync(DOSSIER_DIR, { recursive: true });
  // The desk keeps two kinds of lead apart: what the world published, which
  // is public, and what a person wrote to the desk, which is not. Only the
  // first may go into the repository.
  const leads = Array.isArray(s.leads) ? s.leads : [];
  savePrivateLeads(leads.filter((l) => l?.origin !== 'scan'));
  const out = { ...s, leads: leads.filter((l) => l?.origin === 'scan') };
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(out, null, 2)}\n`);
}

/** The tips that came by letter. Private: this file is never committed. */
function loadPrivateLeads() {
  try {
    const list = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePrivateLeads(list) {
  fs.mkdirSync(DOSSIER_DIR, { recursive: true });
  fs.writeFileSync(LEADS_FILE, `${JSON.stringify(list.slice(0, 20), null, 2)}\n`);
}

/**
 * The list of dossiers the desk is working on. The editor reads it from the
 * repository, so the desk page shows what the desk has on its desk even when
 * no new deployment went out.
 */
function saveDossierIndex(dossiers) {
  fs.mkdirSync(DOSSIER_DIR, { recursive: true });
  const rows = dossiers
    .filter((d) => d && d.slug)
    .map((d) => ({
      slug: d.slug,
      title: d.title || '',
      status: d.status || 'pitch',
      updatedAt: d.updatedAt || d.createdAt || null,
      letters: ledger(d).length,
    }))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  fs.writeFileSync(path.join(DOSSIER_DIR, 'index.json'), `${JSON.stringify({ at: nowISO(), dossiers: rows }, null, 2)}\n`);
}

function note(d, status, message) {
  if (status) d.status = status;
  d.history = [...(d.history || []), { at: nowISO(), status: d.status, note: message }].slice(-80);
}

function newDossier({ title, angle, category, queries, origin, requestId = null, brief = null, priority = 2 }) {
  const ts = nowISO();
  return {
    slug: slugify(title),
    title,
    angle,
    category: pickCategory(category),
    status: 'pitch',
    priority,
    origin,
    requestId,
    brief,
    createdAt: ts,
    updatedAt: ts,
    queries: queries || [],
    keywords: [],
    sources: [],
    claims: [],
    gaps: [],
    contacts: [],
    outreach: [],
    draft: null,
    review: null,
    published: null,
    history: [{ at: ts, status: 'pitch', note: `opened (${origin})` }],
  };
}

function addSource(d, item, extra = {}) {
  const url = String(item.url || '').trim();
  if (!url || d.sources.some((s) => s.url === url)) return false;
  // The number must not be one a claim already points at. A claim that
  // cites S2 must keep citing that document, even after S2 was dropped:
  // the number belongs to the claim as long as the claim is on file.
  const taken = new Set(d.sources.map((s) => s.id));
  for (const c of d.claims || []) for (const id of c.sources || []) taken.add(id);
  let number = d.sources.length + 1;
  while (taken.has(`S${number}`)) number++;
  d.sources.push({
    id: `S${number}`,
    url,
    outlet: item.outlet || 'unknown',
    title: String(item.title || '').slice(0, 300),
    publishedAt: item.publishedAt || null,
    // The filing cabinets know what they are; the feed path has to guess from
    // the address.
    primary: item.primary != null ? Boolean(item.primary) : Boolean(isPrimaryOutlet(item.outlet)) || /(^|\.)(gov|admin|int)(\.|$)|europa\.eu|parlament|bundesgericht|court|un\.org/i.test(url),
    kind: extra.kind || 'news',
    addedAt: nowISO(),
    text: null,
  });
  return true;
}

const STOPWORDS = new Set(['this', 'that', 'with', 'from', 'have', 'were', 'been', 'will', 'about', 'after', 'over', 'into', 'says', 'said', 'their', 'under', 'more', 'what', 'when', 'where', 'which', 'while', 'there', 'these', 'those', 'should', 'would', 'could', 'were', 'deutsch', 'thema', 'einer', 'eines', 'einem', 'einen', 'diese', 'dieser', 'diesem', 'werden', 'wurde', 'wurden', 'nicht', 'auch', 'sowie', 'oder', 'aber', 'noch', 'nur', 'schon', 'sich', 'sind', 'dass', 'nach', 'ueber', 'über', 'beim', 'vom', 'zum', 'zur', 'durch', 'gegen', 'ohne', 'zwischen', 'immer', 'jeder', 'jede', 'jedes', 'keine', 'mehr', 'sowie']);

/**
 * What the desk read goes into the dossier: the text it can cite and the
 * picture the page came with. Without the photo an investigation reaches
 * the site without a lead image.
 */
function fileSourceRead(src, page) {
  if (!src || !page) return;
  if (!src.text && page.text) {
    src.text = String(page.text).slice(0, MAX_SOURCE_CHARS);
    src.readAt = nowISO();
    // The length of the whole document, so the desk knows whether it read
    // the whole thing or only the first pages of it.
    if (Number.isFinite(page.length)) src.textLength = page.length;
  }
  if (!src.image && page.image) {
    src.image = page.image;
    if (page.imageCaption) src.imageCaption = String(page.imageCaption).slice(0, 300);
    if (page.imageCredit) src.imageCredit = String(page.imageCredit).slice(0, 120);
  }
}

function keywordsOf(d) {
  // The brief comes first: it is where the editor names the exact terms the
  // primary sources use, so those must survive the cap.
  const text = `${(d.brief?.hints || '')} ${d.brief?.topic || ''} ${d.brief?.region || ''} ${d.title} ${d.angle}`;
  const seeded = (Array.isArray(d.keywords) ? d.keywords : []).map((k) => String(k).toLowerCase());
  const set = new Set([
    ...seeded,
    ...String(text).toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !STOPWORDS.has(w)),
  ]);
  return [...set].slice(0, 24);
}

function keywordHits(text, keywords) {
  const t = String(text).toLowerCase();
  return keywords.reduce((n, k) => (k && t.includes(k.toLowerCase()) ? n + 1 : n), 0);
}

// Words that describe any story at all. They may never carry a source on
// their own, or every hack in the world matches this investigation.
const GENERIC = new Set(['attack', 'attacks', 'breach', 'hack', 'hacks', 'hacked', 'hacker', 'theft', 'stolen', 'money', 'police', 'report', 'reports', 'reported', 'news', 'story', 'article', 'update', 'latest', 'first', 'last', 'year', 'years', 'said', 'says', 'told', 'after', 'before', 'people', 'group', 'case', 'file', 'files', 'work', 'works', 'world', 'official', 'officials', 'search', 'data', 'part', 'partners', 'investigation', 'investigations', 'business', 'company', 'companies']);

function coreTermsOf(d) {
  const text = `${d.title} ${d.angle} ${d.brief?.topic || ''}`;
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !GENERIC.has(w));
  return [...new Set(words)].slice(0, 12);
}

/**
 * Walk to the institutions and read what they filed.
 *
 * The desk's filing cabinets are doors a reporter walks without asking a
 * model for permission: each door is a public host that files primary
 * documents, and the desk goes there on its own. The registry of doors and
 * the wording they use live in lib/documents.mjs.
 *
 * The model chooses the questions; the documents themselves are the desk's
 * responsibility. This does what a reporter does before writing: goes to the
 * Justice Department, to the sanctions office, to the chain-analysis firms —
 * and puts what it finds on file. Without this the desk keeps filing
 * newspaper headlines and never reaches the paper that makes the story
 * publishable.
 */
async function openPrimaryDoors(d, { maxDoors = 6, maxPerDoor = 2 } = {}) {
  const subject = `${d.title || ''} ${d.angle || ''} ${d.brief?.topic || ''}`;
  const docs = await institutionalDocuments(subject, {
    context: d.brief?.hints || '',
    maxInstitutions: maxDoors,
    limit: 40,
  }).catch(() => []);
  if (!docs.length) return 0;

  // Two documents per institution: enough to show the paper trail, not so
  // much that one institution drowns the story.
  const perDoor = new Map();
  const shortlist = [];
  for (const doc of docs) {
    const n = perDoor.get(doc.outlet) || 0;
    if (n >= maxPerDoor) continue;
    perDoor.set(doc.outlet, n + 1);
    shortlist.push(doc);
  }

  const pages = await Promise.all(
    shortlist.map((doc) => openPage(doc.url, { maxChars: 4000 }).catch(() => null))
  );

  let added = 0;
  for (let i = 0; i < shortlist.length; i++) {
    const doc = shortlist[i];
    const page = pages[i];
    if (!page?.text) continue;
    addSource(
      d,
      { url: doc.url, outlet: doc.outlet, title: page.title || doc.title, publishedAt: doc.publishedAt || null, primary: true },
      { kind: 'document' }
    );
    const src = d.sources.find((s) => s.url === doc.url);
    fileSourceRead(src, page);
    added++;
  }
  if (added) log(`DOORS  ${added} primary document(s) read at ${[...perDoor.keys()].join(', ')}`);
  return added;
}

// A dossier that lists a wildfire next to a bank heist is a dossier nobody
// can publish. A source whose headline shares no word with the story has
// nothing to do with it — unless a claim already leans on it.
const MONTHS = new Set(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);
// Words that belong to every story. They may not keep a source alive.
const FILLER = new Set(['data', 'news', 'report', 'reports', 'story', 'stories', 'people', 'group', 'company', 'part', 'number', 'amount', 'value', 'source', 'sources', 'first', 'last', 'case', 'fact', 'facts', 'issue', 'issues', 'update', 'updates', 'information', 'details', 'detail', 'official', 'officials', 'latest', 'police', 'authorities']);
// Nobody cites these. A link to an encyclopedia or a social network is not a
// document, whatever the headline says. Matched on the host, not on the whole
// URL: "x.com" as a substring also kills "vox.com" and "tax.com".
const NOT_A_SOURCE_HOSTS = new Set([
  'wikipedia.org', 'fandom.com', 'reddit.com', 'twitter.com', 'x.com',
  'facebook.com', 'instagram.com', 'linkedin.com', 'medium.com',
  'blogspot.com', 'wordpress.com', 'tiktok.com', 'quora.com', 'youtube.com',
]);
function notASource(source) {
  const host = hostOf(source?.url);
  if (!host || host === 'unknown') return false;
  return [...NOT_A_SOURCE_HOSTS].some((bad) => host === bad || host.endsWith(`.${bad}`));
}
// The same document behind two tracking links is still one document.
function urlKey(url) {
  try {
    const u = new URL(String(url || ''));
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

// The words that stand in every institutional document. They say how a
// document is written, not what it is about.
function wordPattern(w) {
  return new RegExp(`\\b${String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
}

/**
 * The vocabulary of the story: the words the desk named it with, and the
 * names it keeps coming back to. A document that shares only the words every
 * press release has is about something else, however many of them it uses.
 *
 * The frame (title, angle, brief) is what the desk itself wrote. The names
 * are the proper nouns and figures of that frame plus those the claims keep
 * repeating: a name that shows up in a single sentence belongs to that
 * sentence, not to the story.
 */
function storyVocabulary(d) {
  const brief = d.brief || {};
  const frame = [
    d.title,
    d.angle,
    brief.topic,
    brief.centre,
    brief.people,
    brief.beat,
    brief.border,
    brief.hints,
  ]
    .filter(Boolean)
    .join(' ');
  const words = new Set(
    frame
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 4 &&
          !STOPWORDS.has(w) &&
          !MONTHS.has(w) &&
          !FILLER.has(w) &&
          !GENERIC.has(w) &&
          !BOILERPLATE.has(w)
      )
  );
  const usableName = (n) => n.length >= 4 && !BOILERPLATE.has(n) && !STOPWORDS.has(n);
  const names = new Set(namedTerms(frame).filter(usableName));
  const claims = (d.claims || []).map((c) => String(c.text || '')).filter(Boolean);
  const counts = new Map();
  for (const c of claims) {
    for (const n of namedTerms(c)) {
      if (!usableName(n)) continue;
      counts.set(n, (counts.get(n) || 0) + 1);
    }
  }
  const repeated = claims.length >= 3 ? 2 : 1;
  for (const [n, c] of counts) if (c >= repeated) names.add(n);
  // A term that is both a word of the frame and a name of it is one term.
  // Counted twice, a single mention would look like two.
  const terms = [...new Set([...words, ...names])];
  return {
    words: [...words].map(wordPattern),
    names: [...names].map(wordPattern),
    terms: terms.map(wordPattern),
  };
}

/**
 * The vocabulary of a single claim: the names it mentions and the words
 * that carry it. A document that shares neither with the claim does not
 * support it — whatever the claim file says about it.
 */
function claimVocabulary(text) {
  const src = String(text || '');
  const usable = (n) => n.length >= 4 && !BOILERPLATE.has(n) && !STOPWORDS.has(n) && !GENERIC.has(n);
  const names = [...new Set(namedTerms(src).filter(usable))];
  const words = [
    ...new Set(
      src
        .toLowerCase()
        .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 5 && !STOPWORDS.has(w) && !MONTHS.has(w) && !FILLER.has(w) && !GENERIC.has(w) && !BOILERPLATE.has(w))
    ),
  ];
  return { names: names.map(wordPattern), words: words.map(wordPattern) };
}

/**
 * Does the document carry the claim? A name of the claim in the document, or
 * two of its words, is enough. The check is a floor, not a proof: a claim
 * the document does not mention at all is a claim about something else.
 */
function claimSupportedBy(claim, source) {
  const hay = `${source?.title || ''}\n${source?.text || ''}`;
  if (!hay.trim()) return false;
  const { names, words } = claimVocabulary(claim?.text);
  if (names.some((re) => re.test(hay))) return true;
  return words.filter((re) => re.test(hay)).length >= 2;
}

function pruneOffTopic(d) {
  // The frame the desk wrote belongs to the story: what crosses the border,
  // who carries the consequences, which institution is being followed. A
  // dossier that only remembers the headline loses the reason it opened the
  // story in the first place.
  const { terms } = storyVocabulary(d);
  const vocabulary = terms;
  if (!vocabulary.length) return 0;

  const keep = [];
  const dropped = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  const reasons = new Map();
  for (const s of d.sources) {
    const junk = notASource(s);
    // A second copy of a document that is already on file is not a second
    // source.
    const url = urlKey(s.url);
    const title = String(s.title || '').trim().toLowerCase().replace(/\W+/g, ' ').trim();
    const duplicate = (url && seenUrls.has(url)) || (title && seenTitles.has(title));
    if (url) seenUrls.add(url);
    if (title) seenTitles.add(title);
    // A headline is judged by its words: if it names the story, the document
    // is about the story. A document the desk has read is judged by what it
    // says — two of the story's words, or one of its names. A reporter does
    // not throw away the document they read because the headline was bland,
    // and does not keep one that only repeats what every press release says.
    //
    // A claim does not keep a document alive: a claim that cites a document
    // about another subject is not evidence for this story, and neither is
    // the document it points at.
    const text = String(s.text || '');
    const titleText = String(s.title || '');
    const titleHit = vocabulary.some((re) => re.test(titleText));
    const textHits = vocabulary.filter((re) => re.test(text)).length;
    const onTopic = titleHit || textHits >= 2;
    reasons.set(s, junk ? 'not a source' : duplicate ? 'duplicate' : onTopic ? '' : 'off topic');
    if (!junk && !duplicate && onTopic) {
      keep.push(s);
      continue;
    }
    dropped.push(s);
  }
  if (!dropped.length) return 0;

  // Renumber: the desk hands out S<count+1>, so a gap would collide later.
  const idMap = new Map();
  keep.forEach((s, i) => {
    const next = `S${i + 1}`;
    idMap.set(s.id, next);
    s.id = next;
  });
  // A claim that cited a document which just left the dossier has lost its
  // evidence. It keeps the citations that survived and loses the claim
  // itself when nothing is left: a claim without a document is not a claim.
  const lost = [];
  const byId = new Map(keep.map((s) => [s.id, s]));
  for (const c of d.claims || []) {
    if (!Array.isArray(c.sources)) continue;
    const had = c.sources.length;
    c.sources = c.sources
      .map((id) => idMap.get(id))
      .filter(Boolean)
      .filter((id) => {
        const s = byId.get(id);
        if (!s) return false;
        const whole = Number.isFinite(s.textLength) ? s.textLength <= String(s.text || '').length : false;
        if (!whole) return true;
        return claimSupportedBy(c, s);
      });
    if (c.sources.length !== had) {
      // The document behind the claim changed: the desk has to read it again.
      delete c.checked;
      delete c.checkNote;
    }
    if (!c.sources.length) lost.push(c);
  }
  if (lost.length) {
    d.claims = d.claims.filter((c) => !lost.includes(c));
    for (const c of lost) {
      d.gaps = [...(d.gaps || []), `Nicht belegt, deshalb gestrichen: ${String(c.text || '').slice(0, 200)}`];
    }
    log(`PRUNE  ${lost.length} claim(s) lost their document`);
  }
  d.sources = keep;
  log(
    `PRUNE  ${dropped.length} source(s) dropped: ${dropped
      .map((s) => `${s.outlet || hostOf(s.url)} (${reasons.get(s)})`)
      .join(', ')}`
  );
  return dropped.length;
}

// ─────────────────────────── 1. INTAKE ───────────────────────────
const DESK_RADAR = [
  ['public procurement', 'public tender irregularities contract award audit'],
  ['audit office', 'court of auditors report misuse of public funds'],
  ['subsidies', 'subsidy recipients lobby register transparency'],
  ['EU funds', 'EU funds fraud OLAF investigation report'],
  ['UN agencies', 'United Nations agency procurement internal audit misuse'],
  ['development finance', 'World Bank project complaint inspection panel'],
  ['sanctions', 'sanctions enforcement evasion investigation'],
  ['arms trade', 'arms export licence investigation'],
  ['lobbying', 'lobbying disclosure ministers meetings register'],
  ['courts', 'court ruling government secrecy documents access'],
  // State crime and cyber theft: the money that moves is the trail, and the
  // people who lose it are the reason to report it.
  ['state hacking', 'state-sponsored cyber theft attribution North Korea Lazarus investigation'],
  ['crypto theft', 'crypto exchange hack laundering sanctions evasion victims investigation'],
  // People, not process: the desk also follows what is taken from people.
  ['indigenous rights', 'indigenous peoples land rights eviction extraction investigation'],
  ['natural resources', 'illegal fishing logging mining protected area biodiversity investigation'],
];

// ─────────────────────────── desk memory ───────────────────────────
// A real desk knows what it has already published, what it is working on and
// which institutions it follows. Without that memory every run starts from
// zero: it repeats old stories and forgets the people it owes an answer.
function deskMemory(dossiers, state) {
  const byDate = (a, b) => new Date(a.at || 0) - new Date(b.at || 0);
  const published = dossiers
    .filter((d) => d.status === 'published')
    .map((d) => ({ title: d.title, centre: d.centre || '', at: d.published?.at || d.updatedAt || '' }))
    .sort(byDate);
  const open = dossiers
    .filter((d) => !['archived', 'dropped', 'published'].includes(d.status))
    .map((d) => ({ title: d.title, angle: d.angle || '', status: d.status, centre: d.centre || '' }));
  return {
    published,
    open,
    beats: Array.isArray(state?.beats) ? state.beats : [],
    followups: Array.isArray(state?.followups) ? state.followups : [],
    leads: (Array.isArray(state?.leads) ? state.leads : []).filter((l) => l?.summary && l.origin !== 'scan'),
    finds: (Array.isArray(state?.leads) ? state.leads : []).filter((l) => l?.summary && l.origin === 'scan'),
  };
}

function memoryBlock(mem) {
  const lines = [];
  if (mem.published.length) {
    lines.push('Our own published investigations (never repeat one):');
    for (const p of mem.published.slice(-8)) lines.push(`- ${p.title}${p.centre ? ` — ${p.centre}` : ''}`);
  }
  if (mem.open.length) {
    lines.push('Still on the desk (do not open a second story on the same subject):');
    for (const o of mem.open) lines.push(`- ${o.title} (${o.status})`);
  }
  if (mem.beats.length) {
    lines.push('Beats the desk follows:');
    for (const b of mem.beats.slice(-10)) lines.push(`- ${b.name}${b.centre ? ` — ${b.centre}` : ''}`);
  }
  if (mem.followups.length) {
    lines.push('Owed to our readers (open questions from what we published):');
    for (const f of mem.followups.slice(-6)) lines.push(`- ${f.title}: ${f.question}`);
  }
  if (mem.leads.length) {
    lines.push('Letters that reached the desk without a story of their own (a tip the desk keeps):');
    for (const l of mem.leads.slice(-6)) {
      lines.push(`- ${l.worth && l.title ? `${l.title} — ${l.summary}` : l.summary}`);
    }
  }
  if (mem.finds?.length) {
    lines.push('Notices the desk found by itself and kept for a later week:');
    for (const f of mem.finds.slice(-6)) lines.push(`- ${f.title || f.summary}`);
  }
  return lines.join('\n');
}

// The desk works internationally. Switzerland is the address of the paper,
// not its beat: a story whose centre of gravity is Swiss domestic affairs
// does not belong here, and a story that only looks domestic is not the
// desk's job either.
const SWISS_CENTRE = /(schweiz|swiss|schweizer|switz|suisse|svizzera|eidgen[oö]ssisch|^ch$)/i;
const SWISS_MARKER = /(schweiz|swiss|schweizer|schweizerische|switzerland|eidgen[oö]ssisch|eidgenoessisch|admin\.ch|seco\b|finma|bazg|fedpol|bl\.ch|\bbund\b|bundesrat|bundesverwaltung|kanton\w*|gemeinde\w*|landeskanzlei|suisse|svizzera|basel|zurich|zürich|geneva|genf|lausanne|bern\b)/i;
// The cross-border words. Names of institutions count, the word "who" does
// not — that one is in every sentence about people who lose something.
const BORDER_MARKER = /(international|cross-border|cross border|transnational|global|worldwide|treaty|convention|protocol|\bun\b|\beu\b|european union|european commission|european court|europol|eurojust|echr|council of europe|nato|\bwto\b|\bimf\b|world bank|interpol|fatf|iaea|\bicj\b|\bicc\b|opec|asean|brics|oecd|\bg7\b|\bg20\b|african union|undp|unicef|unhcr|world health organisation|world health organization|united nations|world trade organization|world economic forum|international labour organization|refugee|migrant|embargo|export licen|sanction|money laundering|offshore shell|smuggl|traffick)/i;
// Acronyms are matched case-sensitively on purpose: "WHO" is an institution,
// "who" is a pronoun.
const BORDER_ACRONYM = /\b(US|EU|UN|WHO|WTO|UNCTAD|UNEP|WIPO|ILO|OCHA|ITU|BIS|UNHCR|UNICEF|UNDP|IAEA|INTERPOL|OPEC|ASEAN|NATO|IMF|ICAO|IMO|UNODC|UNDRR|WFP|UNESCO|FATF|ECHR|ICC|ICJ|CDC|FDA|SEC|DOJ|OFAC|FIFA|UEFA|ICRC|UNIDO|UNEP|UNCTAD|ICAO|GPA|CITES|ITU|WHO)\b/;
// A country that is not Switzerland. A story that names one of them is not a
// story about Swiss domestic affairs, whatever else it mentions.
const FOREIGN_MARKER = /(russia|russian|ukraine|ukrainian|belarus|china|chinese|taiwan|sudan|south sudan|syria|syrian|yemen|iran|iraq|gaza|israel|israeli|palestin|west bank|afghan|myanmar|burma|ethiopia|eritrea|somalia|kenya|uganda|tanzania|ghana|nigeria|south africa|zimbabwe|zambia|mozambique|angola|senegal|mali|sudan|sahel|libya|algeria|tunisia|egypt|morocco|saudi|qatar|pakistan|bangladesh|india|nepal|sri lanka|philippines|indonesia|vietnam|thailand|cambodia|laos|myanmar|mongolia|kazakhstan|uzbekistan|turkmenistan|azerbaijan|armenia|georgia|turkey|lebanon|jordan|iraq|bahrain|kuwait|yemen|brazil|mexico|argentina|chile|peru|colombia|venezuela|bolivia|ecuador|guatemala|honduras|nicaragua|haiti|jamaica|cuba|dominican|trinidad|morocco|mauritania|senegal|cameroon|congo|zimbabwe|nicaragua|romania|bulgaria|serbia|hungary|poland|ukraine|moldova|belarus|lithuania|latvia|estonia|finland|norway|denmark|netherlands|belgium|austria|ireland|portugal|spain|italy|greece|croatia|albania|cyprus|malta)\b/i;

function internationalEnough(topic) {
  const centre = String(topic.centre || '').trim();
  if (!centre) return { ok: false, why: 'the topic names no centre' };
  if (SWISS_CENTRE.test(centre)) return { ok: false, why: `the centre is ${centre}` };
  const text = [topic.title, topic.angle, centre, topic.border, topic.people, ...(topic.queries || [])].join(' ');
  const crosses = BORDER_MARKER.test(text) || BORDER_ACRONYM.test(text) || FOREIGN_MARKER.test(text);
  if (SWISS_MARKER.test(text) && !crosses) {
    return { ok: false, why: 'a Swiss story without a cross-border angle' };
  }
  // A story that stays inside one country is a thin one for this desk, but it
  // is not wrong — the desk flags it and keeps working.
  return crosses ? { ok: true } : { ok: true, thin: true };
}

/** True when a story is about Swiss domestic affairs and nothing else. */
function swissOnly(topic) {
  const centre = String(topic.centre || '').trim();
  const text = [topic.title, topic.angle, centre, ...(topic.queries || [])].join(' ');
  if (!SWISS_MARKER.test(text)) return false;
  if (centre && SWISS_CENTRE.test(centre)) return true;
  return !(BORDER_MARKER.test(text) || BORDER_ACRONYM.test(text) || FOREIGN_MARKER.test(text));
}

/**
 * A letter the desk kept is not a story yet. It becomes one when the desk
 * takes it on — and the desk works internationally, so a tip that is really
 * about Swiss domestic affairs stays a tip.
 */
function leadInternational(lead) {
  const text = [lead.title, lead.angle, lead.people, ...(lead.queries || [])].join(' ');
  if (!text.trim()) return { ok: false, why: 'the tip says nothing' };
  if (SWISS_MARKER.test(text) && !(BORDER_MARKER.test(text) || BORDER_ACRONYM.test(text) || FOREIGN_MARKER.test(text))) {
    return { ok: false, why: 'a Swiss story without a cross-border angle' };
  }
  return { ok: true };
}

/**
 * How much two search queries share, as a fraction of the shorter one.
 * "Activision Blizzard Itaewon court case South Korea 2024" and "Activision
 * Blizzard Itaewon court ruling South Korea" are the same search.
 */
function queryOverlap(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

/** What a published piece still owes its readers: the questions it could not close. */
function rememberFollowups(state, d) {
  const questions = (d.gaps || []).map((g) => String(g).trim()).filter((g) => g.length > 20).slice(0, 6);
  if (!questions.length) return;
  state.followups = Array.isArray(state.followups) ? state.followups : [];
  for (const question of questions) {
    if (state.followups.some((f) => f.slug === d.slug && f.question === question)) continue;
    state.followups.push({ slug: d.slug, title: d.title, question, at: nowISO() });
  }
  state.followups = state.followups.slice(-40);
}

/** The desk keeps its beats: the institutions it follows, story after story. */
function rememberBeat(state, dossier, topic) {
  const name = String(topic?.beat || '').trim().slice(0, 90);
  if (!name) return;
  state.beats = Array.isArray(state.beats) ? state.beats : [];
  const existing = state.beats.find((b) => String(b.name).toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.topics = [...new Set([...(existing.topics || []), dossier.slug])].slice(-12);
    existing.at = nowISO();
  } else {
    state.beats.push({ name, centre: String(topic.centre || '').slice(0, 80), topics: [dossier.slug], at: nowISO() });
  }
  state.beats = state.beats.slice(-30);
}

async function intake(dossiers, state) {
  const week = weekKey();
  if (FORCE_SLUG) return;

  // The desk keeps its own plate full within the editorial limits. Intake is
  // not a once-a-week ceremony: it runs whenever the desk still has room for
  // another investigation, so a quiet shift does not leave the board empty.
  const active = dossiers.filter(isActive);
  const openedThisWeek = dossiers.filter((d) => weekKey(new Date(d.createdAt)) === week && !['archived', 'dropped'].includes(d.status)).length;
  let slots = Math.min(INVESTIGATION_QUOTAS.newPerWeek - openedThisWeek, INVESTIGATION_QUOTAS.maxActive - active.length);
  if (slots <= 0) {
    log(`INTAKE  ${openedThisWeek} dossier(s) opened this week (max ${INVESTIGATION_QUOTAS.newPerWeek}), ${active.length} active — nothing to open`);
    state.lastIntake = week;
    return;
  }

  const requests = await safe(() => listRequests({ status: 'new', limit: 40 }), []);
  const memory = deskMemory(dossiers, state);
  log(`INTAKE  ${requests.length} open reader wish(es), ${slots} slot(s), ${memory.published.length} piece(s) in the archive`);

  if (requests.length) {
    const picks = await pickRequests(requests, slots, memory);
    for (const pick of picks) {
      const request = requests.find((r) => String(r.id) === String(pick.id));
      if (!request) continue;
      // A wish for Swiss domestic affairs is a wish the desk does not take:
      // it works internationally, and the slot goes to a story that crosses a
      // border. The wish still counts against the week's quota.
      if (swissOnly(pick)) {
        await safe(() => setRequestStatus(request.id, 'declined', null));
        log(`INTAKE  ✗ reader wish declined (domestic, not the desk's beat) — ${pick.title}`);
        continue;
      }
      const dossier = newDossier({
        title: pick.title || request.topic,
        angle: pick.angle,
        category: pick.category,
        queries: pick.queries,
        origin: 'reader',
        requestId: request.id,
        priority: 1,
        brief: { topic: request.topic, why: request.why, region: request.region, hints: request.hints },
      });
      if (dossiers.some((d) => d.slug === dossier.slug)) continue;
      dossiers.push(dossier);
      await safe(() => setRequestStatus(request.id, 'selected', dossier.slug));
      log(`INTAKE  ✓ reader wish → ${dossier.slug}`);
      slots--;
    }
  }

  if (slots > 0) {
    // A letter the desk kept can become a story, and so can a notice the desk
    // found by itself. Either way it goes into the same quota as every other
    // investigation.
    const tips = (Array.isArray(state.leads) ? state.leads : [])
      .filter((l) => l?.worth && l.title && !l.opened && l.tried !== week);
    // Someone who took the trouble to write in comes before the desk's own
    // scan. Within each group the oldest lead is taken first.
    const written = tips.filter((l) => l.origin !== 'scan');
    const scanned = tips.filter((l) => l.origin === 'scan');
    const tip = written[written.length - 1] || scanned[0] || null;
    if (tip) {
      const gate = leadInternational(tip);
      if (!gate.ok) {
        tip.tried = week;
        log(`INTAKE  ✗ own tip not taken on: ${gate.why} — ${tip.title}`);
      } else {
        const dossier = newDossier({
          title: tip.title,
          angle: tip.angle,
          category: tip.category || 'world',
          queries: tip.queries,
          origin: 'desk',
          priority: 2,
          brief: {
            people: tip.people,
            tip: tip.summary,
            centre: tip.centre,
            // The notice itself. Its words are the vocabulary of the story,
            // so the document the desk started from stays on file.
            hints: tip.docTitle || '',
          },
        });
        if (tip.centre) dossier.centre = tip.centre;
        // The notice the desk found is the first document of the dossier: the
        // story starts from a document, not from a headline.
        if (tip.url) {
          addSource(
            dossier,
            {
              url: tip.url,
              outlet: tip.outlet || 'unknown',
              title: tip.docTitle || tip.title,
              publishedAt: tip.publishedAt || null,
              primary: true,
            },
            { kind: 'document' }
          );
        }
        if (!dossiers.some((d) => d.slug === dossier.slug)) {
          dossiers.push(dossier);
          tip.opened = dossier.slug;
          tip.tried = week;
          // The institution the notice came from is one the desk now follows.
          if (tip.outlet) rememberBeat(state, dossier, { beat: tip.outlet, centre: tip.centre });
          log(`INTAKE  ✓ own ${tip.origin === 'scan' ? 'find' : 'tip'} → ${dossier.slug} — ${tip.title}`);
          slots--;
        }
      }
    }
  }

  if (slots > 0) {
    const topic = await deskTopic(memory);
    if (topic) {
      // The desk is international. A topic that turns out to be one country's
      // own affairs does not get filed: the slot is better left empty than
      // filled with something the desk does not cover.
      const gate = internationalEnough(topic);
      if (!gate.ok) {
        log(`INTAKE  ✗ own topic rejected: ${gate.why} — ${topic.title}`);
      } else {
        const dossier = newDossier({
          ...topic,
          origin: 'desk',
          priority: 3,
          // The frame the desk picked — what crosses the border, who carries
          // the consequences — belongs in the brief, because that is what the
          // research agent reads before it opens the first document.
          brief: {
            centre: topic.centre,
            border: topic.border,
            people: topic.people,
            beat: topic.beat,
          },
        });
        if (!dossiers.some((d) => d.slug === dossier.slug)) {
          dossier.centre = topic.centre;
          dossier.beat = topic.beat;
          dossiers.push(dossier);
          rememberBeat(state, dossier, topic);
          log(`INTAKE  ✓ own topic → ${dossier.slug} (${topic.centre}${topic.beat ? `, beat: ${topic.beat}` : ''})`);
          if (gate.thin) log(`INTAKE  … thin international angle — ${topic.title}`);
        }
      }
    } else {
      log('INTAKE  no own topic met the bar this week');
    }
  }

  state.lastIntake = week;
}

async function pickRequests(requests, slots, memory = {}) {
  const list = requests.slice(0, 25).map((r, i) => {
    return `#${i + 1} id=${r.id}\nTOPIC: ${r.topic}\nWHY: ${r.why || '-'}\nREGION: ${r.region || '-'}\nHINTS: ${r.hints || '-'}`;
  }).join('\n\n');

  try {
    const { data, model } = await chatJSON('desk', [
      {
        role: 'system',
        content: `You are the investigative editor of PLAIN., a small independent news site. The desk works internationally: prefer stories that cross borders or touch an international institution, and treat purely national affairs as a last resort. You commission at most two investigations per week and you would rather open one than open a weak one. You write about people: a topic where nobody can be named as losing, profiting or living with the consequences is a process topic, not a story. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Reader wishes for this week:\n\n${list}\n\nChoose at most ${slots} to investigate over the coming weeks or months.

A topic qualifies only if ALL of these hold:
- public interest (money, power, safety, rights), not a private dispute or a personal grievance;
- a concrete, verifiable core: decisions, contracts, payments, appointments, court rulings, documents;
- answerable with public records, data, court files and email questions to the institutions — no hidden sources are needed;
- not already covered by our own archive as an investigation;
- serious enough to justify weeks of work;
- people are visible in it: the readers who asked for it, the people it is done to, the ones who profit from it. Preference goes to stories where ordinary people carry the consequences of what powerful actors decide.

Reject speculation, conspiracy framing, "someone should look into X" without a specific institution or decision, and topics that are really opinion.

What the desk already has (this is its own memory — do not repeat it):
${memoryBlock(memory) || '(nothing yet — this would be the first piece)'}

Return exactly:
{"picks":[{"id":"the id above","title":"working headline, max 90 characters, factual","angle":"one sentence: the question the investigation answers","category":"politics|business|world|tech|science|climate|health|culture|sport","centre":"the country or region the story is really about","border":"what crosses a border in it: money, people, a treaty, an institution","people":"who is affected and who profits","queries":["4-6 search queries in the language of the primary sources, each with the specific institution, programme or decision"]}]}
Return {"picks":[]} if nothing qualifies.`,
      },
    ], { temperature: 0.3, maxTokens: 2000 });
    const picks = (Array.isArray(data.picks) ? data.picks : [])
      .filter((p) => p && p.id)
      .slice(0, slots)
      .map((p) => ({
        id: p.id,
        title: String(p.title || '').trim().slice(0, 120),
        angle: String(p.angle || '').trim().slice(0, 300),
        category: String(p.category || 'politics'),
        centre: String(p.centre || '').trim().slice(0, 80),
        border: String(p.border || '').trim().slice(0, 300),
        people: String(p.people || '').trim().slice(0, 300),
        queries: (Array.isArray(p.queries) ? p.queries : []).map(String).filter((q) => q.length > 5).slice(0, 6),
      }));
    log(`INTAKE  desk model ${model} selected ${picks.length}`);
    return picks;
  } catch (err) {
    log(`INTAKE  selection failed: ${err.message}`);
    return [];
  }
}

async function deskTopic(memory = {}) {
  const weekNum = Number(weekKey().split('-W')[1]) || 1;
  const picks = [DESK_RADAR[weekNum % DESK_RADAR.length], DESK_RADAR[(weekNum + 3) % DESK_RADAR.length]];
  // The radar queries go through Google News, which is close to empty on CI
  // runners. The desk's own wires are what a reporter actually reads, so they
  // carry the topic hunt and the radar feeds only add to it.
  const feeds = [
    ...picks.map(([label, query]) => ({ outlet: `Radar: ${label}`, url: googleNews(query), kind: 'aggregator' })),
    ...DESK_FEEDS,
  ];
  const { items } = await safe(() => fetchFeeds(feeds, { maxAgeHours: 24 * 10, perFeed: 25 }), { items: [] });
  if (!items.length) return null;

  const newest = [...items].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  const heads = newest.slice(0, 60).map((i) => `- ${i.outlet}: ${i.title}`).join('\n');
  try {
    const { data } = await chatJSON('desk', [
      {
        role: 'system',
        content: `You are the investigative editor of PLAIN. You look at the news of the last ten days and ask which development deserves documents, data and questions rather than another report. The desk works internationally: a story that only concerns one country's own affairs must carry a cross-border institution, a shared pattern or money that crosses a border — and Switzerland is where the paper is published, not what it covers, so a story whose centre is Swiss domestic affairs is not this desk's story. You write about people: a story without visible people behind it — without anyone who lost something, profits from it or lives with the consequences — is a process story, not a story. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Recent headlines:\n${heads}\n\nIs there ONE story here with an investigative core — public money, a decision, a contract, a court case, a pattern across institutions? It must be answerable with public records and email questions. It must also have people in it: who loses, who profits, who is left to live with the consequences. Stories about people affected by power — by settlement, extraction, state crime, a hacked account, a taken land — beat stories about a procedure.

If one of the questions the desk still owes its readers has been answered in these headlines, that answer is the story to propose: a desk that comes back to its own reporting.

What the desk already has (its own memory — a new piece must not repeat it, and the desk should not open two stories about the same country in a row):
${memoryBlock(memory) || '(nothing yet — this would be the first piece)'}

Return {"topic":{"title":"working headline, max 90 characters","angle":"the question the investigation answers","category":"politics|business|world|tech|science|climate|health|culture|sport","centre":"the country or region the story is really about","border":"what crosses a border in it: money, people, a treaty, an institution","people":"who is affected and who profits","beat":"the institution or body the desk would follow up on, e.g. an agency, a court, a fund","queries":["4-6 specific search queries"]}} or {"topic":null} if none qualifies.`,
      },
    ], { temperature: 0.4, maxTokens: 2400, numCtx: 32768, timeoutMs: 120000 });
    const t = data?.topic;
    if (!t || !t.title || !Array.isArray(t.queries) || t.queries.length < 2) return null;
    return {
      title: String(t.title).slice(0, 120),
      angle: String(t.angle || '').slice(0, 300),
      category: String(t.category || 'politics'),
      centre: String(t.centre || '').trim().slice(0, 80),
      border: String(t.border || '').trim().slice(0, 300),
      people: String(t.people || '').trim().slice(0, 300),
      beat: String(t.beat || '').trim().slice(0, 90),
      queries: t.queries.map(String).filter((q) => q.length > 5).slice(0, 6),
    };
  } catch (err) {
    log(`INTAKE  desk topic failed: ${err.message}`);
    return null;
  }
}

// ─────────────────────────── 2. RESEARCH ───────────────────────────
async function ensureQueries(d) {
  if (d.queries?.length >= 2) return;
  const { data } = await chatJSON('desk', [
    {
      role: 'system',
      content: 'You are a research planner for an investigative desk. Return JSON only.',
    },
    {
      role: 'user',
      content: `Investigation: ${d.title}\nQuestion: ${d.angle}\nReader brief: ${JSON.stringify(d.brief || {})}\n\nWrite 4-6 search queries in the language of the primary sources (English, French, Spanish, German) that would surface: official documents, audit reports, court rulings, procurement notices and reporting by independent outlets. Each query must name a specific institution, programme or decision.\n\nReturn {"queries":["…"]}`,
    },
  ], { temperature: 0.4, maxTokens: 800 });
  d.queries = (Array.isArray(data.queries) ? data.queries : []).map(String).filter((q) => q.length > 5).slice(0, 6);
  if (!d.queries.length) throw new Error('no research queries');
}

// ─────────────────────────── 2a. AGENT ───────────────────────────
// The desk works like a reporter with a browser and a phone: it searches,
// opens documents, follows links, writes down what it can prove, and keeps a
// list of who has to answer. One run per day, state on disk.
async function researchAgent(d) {
  const cache = new Map();
  const startedSources = d.sources.length;
  const startedClaims = d.claims.length;
  pruneOffTopic(d);

  // Google and Bing answer CI runners with empty feeds most of the time. The
  // desk's own watchlist — world broadcasters, wires and primary sources — is
  // the corpus a reporter actually reads in the morning, so searching starts
  // there and the aggregators are only the second opinion.
  const wireRes = await safe(
    () => fetchFeeds(DESK_FEEDS, { maxAgeHours: 24 * 7, perFeed: 20 }),
    { items: [] },
  );
  const wire = (wireRes.items || []).filter((it) => it.url);
  log(`WIRE  ${wire.length} headline(s) from ${DESK_FEEDS.length} desk feeds`);

  // Before the model searches anything, the desk goes to the institutions
  // itself. Whatever is filed here is on file before the agent writes a single
  // claim, so the claims rest on documents instead of on headlines.
  const doorsBefore = d.sources.filter((s) => s.primary).length;
  await openPrimaryDoors(d).catch(() => 0);
  const doorsAdded = d.sources.filter((s) => s.primary).length - doorsBefore;

  // Every search opens its first hits; the cap keeps a run with a slow or
  // hostile site from spending the whole budget in page fetches.
  let autoOpenBudget = 6;
  // How often the desk has looked for something and found nothing written
  // down. A reporter who searches twelve times and writes nothing has not
  // worked, and the desk says so.
  let searches = 0;

  // A reporter who has already looked for something does not look for it
  // again with one word changed. A shift that stalled on the Call of Duty
  // story ran twelve searches, six of them the same query with a year or an
  // outlet name added; each cost half a minute it could have spent reading.
  // A near-repeat returns the earlier hits instead of hitting the wire again.
  const issued = [];

  const termsOf = (q) => String(q).toLowerCase()
    .replace(/\bsite:\S+/gi, ' ')
    .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
    .split(/\s+/)
    // A year matches every headline of that year - it is no evidence at all.
    .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !/^(the|and|for|with|from|about|und|der|die|das|von|fuer|mit|auf)$/i.test(w));
  const wireMatches = (q, n = 8) => {
    // Only the first terms count: a long angle would let a headline match on
    // two incidental words.
    const terms = termsOf(q).slice(0, 8);
    if (!terms.length) return [];
    // One shared word is not a match. Two terms, or one distinctive one
    // ("bitget", "lazarus"), before a headline may enter.
    const distinctive = terms.filter((t) => t.length >= 6);
    return wire
      .map((it) => {
        const text = `${it.title} ${it.summary}`.toLowerCase();
        const hits = terms.filter((t) => text.includes(t));
        const strong = hits.some((t) => distinctive.includes(t));
        return { it, score: hits.length, strong };
      })
      .filter((x) => x.score >= 2 || x.strong)
      .sort((a, b) => b.score - a.score || new Date(b.it.publishedAt || 0) - new Date(a.it.publishedAt || 0))
      .slice(0, n)
      .map((x) => x.it);
  };

  const state = () =>
    [
      `SOURCES ON FILE (${d.sources.length})`,
      d.sources.map((s) => `[${s.id}] ${s.outlet}${s.primary ? ' (primary)' : ''} — ${s.title} — ${s.url}`).join('\n') || '(none)',
      '',
      `CLAIMS ON FILE (${d.claims.length})`,
      d.claims.map((c) => `[${c.id}] ${c.text} (${c.sources.join(',')})`).join('\n') || '(none)',
      '',
      `GAPS (${d.gaps.length})`,
      d.gaps.map((g) => `- ${g}`).join('\n') || '(none)',
    ].join('\n');

  // What the desk read is part of the dossier's paper trail. Filing it here
  // means a run cannot end with "I read a lot" and nothing on file.
  const readPage = async (target, maxChars = 7000) => {
    let page = await openPage(target, { maxChars });
    // A document that has been taken down is not a document that does not
    // exist: the archive kept a copy, and the desk can cite that.
    if (page.error && !page.text) {
      const copies = await archivedCopy(target, { limit: 1 }).catch(() => []);
      const copy = copies[0];
      if (copy?.url) {
        const archived = await openPage(copy.url, { maxChars });
        if (!archived.error && archived.text) {
          page = { ...archived, title: archived.title || copy.title, viaArchive: true };
        }
      }
    }
    if (page.error && !page.text) return { url: target, error: page.error };
    cache.set(target, page);
    addSource(d, { url: target, outlet: hostOf(target), title: page.title || target, publishedAt: null }, { kind: 'read' });
    const src = d.sources.find((s) => s.url === target);
    fileSourceRead(src, page);
    return {
      url: target,
      title: page.title,
      text: page.text,
      links: (page.links || []).slice(0, 20),
      sourceId: src?.id || null,
      ...(page.viaArchive ? { note: 'the page was gone; the text comes from the archive copy' } : {}),
      ...(page.pdf ? { document: 'PDF — text extracted, cite page-level detail only as printed' } : {}),
    };
  };

  const tools = [
    {
      name: 'search',
      args: '{"query": string}',
      description: 'Search the desk wire (world broadcasters, wires, official sources), the news index in every country edition, the filing cabinets (US Justice Department, UN newsroom, World Bank procurement), the document registries (company filings, government notices, recorded crypto losses) and the wide web. The first two hits are opened and filed automatically; their text comes back in "opened" with a source id. Read that text and record the claims it supports.',
      run: async ({ query }) => {
        const q = String(query || '').trim().slice(0, 120);
        if (q.length < 3) return { error: 'query too short' };
        // A search for a link means "read this page". The model puts the url
        // into the search box because that is the field it is sure about; the
        // desk opens the page instead of asking the whole world for it.
        if (looksLikeUrl(q)) {
          const page = await readPage(q);
          if (page.error) return { note: 'that url could not be opened — try another one', ...page };
          return {
            note: 'the link was opened and filed — read the text and save_claim what it says',
            ...page,
          };
        }
        const tokens = new Set(termsOf(q));
        const again = tokens.size ? issued.find((x) => queryOverlap(x.tokens, tokens) >= 0.8) : null;
        if (again) {
          log(`SEARCH  "${q}" → nearly the same as "${again.query}" — not searched again`);
          return {
            ...again.result,
            note: `you already searched nearly this ("${again.query}") and got the same pages. Do not search again: call open with one of these urls, read the text and save_claim what it says.`,
          };
        }
        searches += 1;
        const seen = new Set();
        const hits = [];
        const collect = (list) => {
          for (const h of list) {
            if (!h.url || seen.has(h.url)) continue;
            seen.add(h.url);
            hits.push(h);
          }
        };
        const fromWire = wireMatches(q);
        collect(fromWire);
        // The aggregators are thin from CI, not the topic, so the bare-words
        // query goes out in parallel instead of after a 25-second timeout.
        const short = termsOf(q).slice(0, 4).join(' ').trim();
        const [primary, bare, cabinets, wide, papers] = await Promise.all([
          // The news index in every edition: a story is written where it
          // happens, and the desk needs the outlets of that country.
          webSearch(q, { limit: 12, editions: NEWS_EDITIONS }).catch(() => []),
          short && short.toLowerCase() !== q.toLowerCase()
            ? webSearch(short, { limit: 12 }).catch(() => [])
            : Promise.resolve([]),
          filingCabinets(q, { limit: 10 }).catch(() => []),
          wideSearch(q, { limit: 10 }).catch(() => []),
          documentSearch(q, { limit: 8 }).catch(() => []),
        ]);
        collect(cabinets);
        collect(papers);
        collect(primary);
        collect(wide);
        if (hits.length < 3) collect(bare);
        // Never answer with an empty page: hand over the wire headlines that
        // are about this story. Unrelated headlines are worse than none — a
        // dossier that lists a wildfire next to a bank heist is a dossier
        // nobody can publish.
        if (hits.length < 3) collect(wireMatches(`${d.title} ${d.angle}`, 8));

        // The desk reads what it finds. Documents come first — a story needs
        // the papers, not only the headlines — and the first two hits are
        // opened and filed right here, because a run that only searches ends
        // with an empty dossier.
        const order = [...hits.filter((h) => h.primary), ...hits.filter((h) => !h.primary)];
        const auto = order.slice(0, 2).filter((h) => autoOpenBudget > 0 && !d.sources.some((s) => s.url === h.url));
        autoOpenBudget -= auto.length;
        const opened = (await Promise.all(auto.map(async (h) => {
          const page = await openPage(h.url, { maxChars: 4000 }).catch(() => null);
          if (!page?.text) return null;
          addSource(d, { url: h.url, outlet: h.outlet || hostOf(h.url), title: page.title || h.title, publishedAt: h.publishedAt || null, primary: h.primary }, { kind: h.kind === 'document' ? 'document' : 'read' });
          const src = d.sources.find((s) => s.url === h.url);
          fileSourceRead(src, page);
          return { outlet: h.outlet || hostOf(h.url), url: h.url, sourceId: src?.id || null, title: page.title || h.title, text: page.text.slice(0, 900) };
        }))).filter(Boolean);

        const results = order.slice(0, 14).map((h) => ({ title: String(h.title || '').slice(0, 90), url: h.url, outlet: h.outlet, primary: !!h.primary }));
        const wireN = fromWire.filter((w) => seen.has(w.url)).length;
        const docsN = results.filter((r) => r.primary).length;
        // One note, not three: the model reads the last value it gets, so the
        // guidance about where the hits came from has to travel together.
        const notes = [];
        if (wireN) notes.push(`${wireN} hit(s) come from the desk wire`);
        if (docsN) notes.push(`${docsN} primary document(s) on file`);
        if (opened.length) notes.push(`${opened.length} page(s) were opened and filed — read their text and save the claims they support`);
        // The desk opens the first hits itself. When that budget is used up
        // the model has to open the page itself, and it has to be told.
        else if (results.length) notes.push('nothing was opened for you — call open with one of these urls, read the text, then save_claim what it says');
        if (!results.length) notes.push('no hits — try 2-3 words, or a "site:" query for the institution\'s own portal');
        // A desk that searches and writes nothing down has not worked. The
        // shift is short; say what is missing instead of letting the model
        // search the same story twelve times.
        if (searches >= 3 && d.claims.length === startedClaims) notes.push(`you have searched ${searches} times and written down no claim — stop searching: open a result, read the text, save_claim what it says`);
        log(`SEARCH  "${q}" → ${results.length} hit(s) (wire ${wireN}, documents ${docsN}, opened ${opened.length})`);
        const payload = {
          // The note comes first: the observation is cut off at 3200
          // characters, and the guidance is the part that must survive.
          ...(notes.length ? { note: notes.join(' — ') } : {}),
          query: q,
          // The list of urls comes before the excerpts. A model that only
          // searches has to see first what it could open; the pages it read
          // are already on file, and the desk writes down what they prove.
          results,
          opened: opened.map((o) => ({ ...o, text: String(o.text || '').slice(0, 600) })),
        };
        issued.push({ query: q, tokens, result: payload });
        return payload;
      },
    },
    {
      name: 'open',
      args: '{"url": string}',
      description: 'Open a page or document and return its title, running text and the links that lead further. Only URLs seen in an earlier observation.',
      run: async ({ url }) => {
        const target = String(url || '').trim();
        if (!/^https?:\/\//i.test(target)) return { error: 'not a URL' };
        return readPage(target);
      },
    },
    {
      name: 'save_source',
      args: '{"url": string, "outlet": string, "title": string, "publishedAt": "YYYY-MM-DD"?}',
      description: 'File a source in the dossier. Use for anything you rely on — articles, official pages, court decisions, tender notices.',
      run: async ({ url, outlet, title, publishedAt }) => {
        const target = String(url || '').trim();
        if (!/^https?:\/\//i.test(target)) return { error: 'not a URL' };
        const added = addSource(
          d,
          { url: target, outlet: String(outlet || hostOf(target)), title: String(title || target), publishedAt: publishedAt || null },
        );
        const src = d.sources.find((s) => s.url === target);
        if (src && cache.has(target)) fileSourceRead(src, cache.get(target));
        return { added, id: src?.id || null, total: d.sources.length };
      },
    },
    {
      name: 'save_claim',
      args: '{"text": string, "sources": ["S1"], "contested": boolean?}',
      description: 'Record one verifiable finding that the cited sources directly support. One fact per claim: who, what, when, how much. Never a reading of motives. Source ids come from save_source or the sourceId that open returned.',
      run: async ({ text, sources, contested }) => {
        const value = String(text || '').trim().slice(0, 600);
        const ids = [...new Set((Array.isArray(sources) ? sources : []).map((s) => String(s).trim()).filter(Boolean))];
        const known = new Set(d.sources.map((s) => s.id));
        const valid = ids.filter((id) => known.has(id));
        if (value.length < 20) return { error: 'claim too short' };
        if (!valid.length) return { error: `no valid source id — on file: ${[...known].join(', ') || 'none'}` };
        const norm = value.toLowerCase().replace(/\W+/g, ' ').trim();
        const dup = d.claims.find((c) => c.text.toLowerCase().replace(/\W+/g, ' ').trim() === norm);
        if (dup) return { duplicate: dup.id };
        // The next free number, not the length plus one: a dossier that ever
        // loses a claim would otherwise hand out an id that is already taken.
        const used = new Set(d.claims.map((c) => c.id));
        let number = 1;
        while (used.has(`C${number}`)) number++;
        const claim = {
          id: `C${number}`,
          text: value,
          sources: valid,
          status: contested ? 'contested' : 'verified',
          weight: 2,
          checkedAt: nowISO(),
        };
        d.claims.push(claim);
        return { id: claim.id, total: d.claims.length };
      },
    },
    {
      name: 'add_gap',
      args: '{"text": string}',
      description: 'Note an open question that still needs a document, a figure or an answer. Be concrete: which office, which file.',
      run: async ({ text }) => {
        const value = String(text || '').trim().slice(0, 300);
        if (value.length < 15) return { error: 'gap too short' };
        if (d.gaps.some((g) => g.toLowerCase() === value.toLowerCase())) return { duplicate: true };
        d.gaps.push(value);
        return { total: d.gaps.length };
      },
    },
    {
      name: 'contact',
      args: '{"org": string, "role": string, "email"?: string, "sourceUrl"?: string}',
      description: 'File an institution or person who must answer, with the address you found on their own website. Never guess an address; if you cannot find one, omit it.',
      run: async ({ org, role, email, sourceUrl }) => {
        const name = String(org || '').trim().slice(0, 160);
        if (name.length < 3) return { error: 'org too short' };
        const mail = String(email || '').trim();
        if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { error: 'email looks invalid — drop it or find the published address' };
        const existing = d.contacts.find((c) => sameOrg(c.org, name));
        if (existing) {
          if (mail && !existing.email) {
            existing.email = mail;
            existing.emailSource = sourceUrl || null;
          }
          return { updated: true, total: d.contacts.length };
        }
        d.contacts.push({
          org: name,
          role: String(role || 'must be asked for comment').slice(0, 300),
          ...(mail ? { email: mail, emailSource: sourceUrl || null } : {}),
        });
        return { added: true, total: d.contacts.length };
      },
    },
    {
      name: 'find_contact',
      args: '{"domain": string}',
      description: 'Read the press address an organisation publishes on its own website. Give the domain you saw in a URL (for example "trmlabs.com"); it reads the contact, press and media pages and answers with the address and the page it was read from. Nothing is guessed.',
      run: async ({ domain }) => {
        const host = String(domain || '').trim();
        if (!host) return { error: 'no domain given' };
        const found = await publishedEmail(host).catch(() => null);
        if (!found) {
          return { found: false, domain: host, note: 'no published address on their own pages — file the contact without one' };
        }
        return { found: true, ...found };
      },
    },
  ];

  const steps = Math.max(4, +(process.env.INVESTIGATE_AGENT_STEPS || 10));
  // The model gets part of the shift, not the whole of it. The rest belongs
  // to the work that follows: reading the documents back, finding the press
  // addresses, writing the letters. A desk that spends the whole shift
  // asking questions has answered nobody.
  const budget = Number.isFinite(deadlineLeft()) ? deadlineLeft() : 0;
  const share = modelShare(budget);
  const { final, steps: log2 } = await runAgent({
    role: 'desk',
    system: `You are the international investigative desk of PLAIN., an independent news site. You work with documents, not with impressions: you open the tender notice, the audit report, the court ruling and the press release, and you write down only what they say. Your beat is cross-border — Brussels, Washington, Geneva, Nairobi, Singapore — and a national story only matters if it connects to an institution, a programme or a pattern beyond one country. You never invent a URL, a figure, a name or a date, and you never describe what someone was thinking — only what they did and what a document proves. You write about people: for every story you look for the ones who carry the consequences and the ones who profit from them, and you name them. Write your findings in English.`,
    task: `INVESTIGATION: ${d.title}
QUESTION: ${d.angle}
DESK BRIEF: ${JSON.stringify(d.brief || {})}
SEARCHES THAT WORKED FOR THIS STORY: ${(d.queries || []).join(' · ') || '(none yet)'}
${d.nextStep ? `NOTE FROM THE LAST SHIFT: ${d.nextStep}` : ''}
${(d.dropped || []).length ? `ALREADY THROWN OUT (no source carries them):\n${d.dropped.slice(-6).map((x) => `- ${x.text}`).join('\n')}` : ''}

${state()}

WHAT THIS RUN SHOULD ACHIEVE
Target for a publishable investigation: ${MIN_SOURCES} distinct outlets, ${MIN_PRIMARY} official/primary sources, ${MIN_CLAIMS} supported claims.
Priorities, in order: (1) find the primary documents — court judgments, audit reports, procurement and award notices, agency decisions, sanctions lists, FOI releases, official statistics; (2) open them, so they land on file; (3) record claims the documents support, one fact each; (4) find who must respond and their published press address.
For every institution that must answer, call find_contact with its domain — the host of a URL you have already seen, for example "trmlabs.com" — and file what it returns with contact, together with the page the address came from. An institution without an address is still worth filing, but with one the desk can actually write to.
Ask for the document itself with "site:" queries: site:ungm.org (UN tenders), site:ted.europa.eu (EU tenders), site:sam.gov (US contracts), site:gao.gov, site:eca.europa.eu and site:nao.org.uk (audit reports), site:curia.europa.eu (EU judgments), site:icc-cpi.int (ICC), site:worldbank.org, site:oecd.org, site:reliefweb.int. When the trail leads into a country, add its audit office, its procurement portal and its court database.
If the story is an attack, a theft or a breach, the question behind it is always "who did it and where did the money go": find the attribution evidence (IP ranges, malware families, on-chain addresses, sanctions listings, indictments), the laundering route, and the people who lost what was taken. Useful doors for that class: site:trmlabs.com, site:chainalysis.com, site:ic3.gov, site:justice.gov, site:ofac.treasury.gov, site:cert.europa.eu, site:enisa.europa.eu, site:un.org, site:ohchr.org, site:sanctions.io. If the story is about land, extraction or settlement, name the people who live there and what they lost.
Every search already opens and files its first two hits. Read the text under "opened", record two or three facts per page with save_claim and the sourceId that came with it, and only then search again — a run that keeps searching without filing has produced nothing.
Every search also goes through the desk's filing cabinets: the US Justice Department's press releases, the UN newsroom, the World Bank's procurement notices and the world archive. Results marked "primary" are documents — open them, they are what makes the story publishable. The wide web is searched too, but it is the least reliable of the four; when it returns nothing, name the institution and search its own portal instead.
${doorsAdded ? `The desk has already been to the institutions before you started: ${doorsAdded} document(s) from the filing cabinets are on file. Read their text above and write down what they prove, before you search for anything else. A story about an attack or a theft is carried by the indictment, the sanction and the attribution report — not by the headlines about it.` : ''}`,

    tools,
    maxSteps: steps,
    deadline: share > 0 ? Date.now() + share : 0,
    log,
  });

  if (final) d.nextStep = final.slice(0, 300);
  d.agent = [...(d.agent || []), { at: nowISO(), steps: log2, final }].slice(-3);

  const added = d.sources.length - startedSources;
  let claims = d.claims.length - startedClaims;

  // A weak model can gather the right documents and still forget to write the
  // claims down. The desk then does what a desk does: read the pages on file
  // and extract the facts itself.
  const doorIds = new Set(d.sources.filter((s) => s.primary && s.kind === 'document').map((s) => s.id));
  const doorsCited = d.claims.some((c) => (c.sources || []).some((id) => doorIds.has(id)));
  // A document that no claim leans on is a document nobody has read yet.
  const cited = new Set((d.claims || []).flatMap((c) => c.sources || []));
  const unread = d.sources.filter((s) => s.text && !cited.has(s.id));
  if (unread.length && (claims === 0 || unread.length >= 2 || (doorsAdded > 0 && !doorsCited))) {
    log(`RESEARCH  extracting from ${unread.length} document(s) on file`);
    await safe(() => extract(d), null);
    claims = d.claims.length - startedClaims;
  }

  log(`RESEARCH  agent: ${added} source(s), ${claims} claim(s), ${d.contacts.length} contact(s)`);

  // The agent works with a wide net and brings home the neighbours too. The
  // second sweep is what keeps the dossier readable.
  pruneOffTopic(d);

  await fillContactAddresses(d);

  if (added === 0 && claims === 0 && d.sources.length === 0) return false;
  if (['pitch'].includes(d.status) && d.sources.length >= 3) note(d, 'research', `${d.sources.length} sources`);
  return true;
}

/**
 * An institution that must answer but has no address yet gets one, read off
 * the pages of its own website: the site the story already cites, or the one
 * the organisation's own name leads to. A letter without an address is a
 * letter nobody can send.
 */
async function fillContactAddresses(d) {
  const hosts = [...new Set(d.sources.map((s) => hostOf(s.url)))].filter((h) => h && h !== 'unknown');
  let filled = 0;
  const pending = (d.contacts || []).filter((c) => !c.email);
  for (const contact of pending.slice(0, 4)) {
    // One address must not eat the shift. The hunt is worth more when it
    // reaches four institutions than when it finishes one of them slowly,
    // and the shift needs room for the letter that follows.
    if (deadlineLeft() < 45_000) {
      log('RESEARCH  deadline close - the rest of the addresses wait for the next shift');
      break;
    }
    const found = await pressAddressFor(contact.org, { hosts, budgetMs: 25_000 }).catch(() => null);
    if (!found) continue;
    contact.email = found.email;
    contact.emailSource = found.sourceUrl;
    filled++;
  }
  if (filled) log(`RESEARCH  ${filled} contact address(es) read from the organisations' own pages`);
  return filled;
}

/**
 * The model gets part of the shift, not the whole of it. The rest belongs to
 * the work that follows: reading the documents back, finding the press
 * addresses, writing the letters. A desk that spends the whole shift asking
 * questions has answered nobody.
 */
function modelShare(budget) {
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  return Math.min(Math.max(Math.floor(budget * 0.55), 150_000), 480_000);
}

/** A link the model put into the search box is a page it wants to read. */
function looksLikeUrl(text) {
  return /^https?:\/\/\S+$/i.test(String(text || '').trim());
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

// ─────────────────────────── 2b. INBOX ───────────────────────────
// Replies come in under the desk's own address. Each one is read, turned into
// claims and gaps, and — if it asks something — answered in a draft that still
// needs the editor's approval before it leaves the building.
function addEmailSource(d, msg) {
  const url = `mailto:${msg.from_email}`;
  const title = `Antwort: ${String(msg.subject || '(ohne Betreff)').slice(0, 160)}`;
  const existing = d.sources.find((s) => s.kind === 'email' && s.url === url && s.title === title);
  if (existing) return existing;
  const src = {
    id: `S${d.sources.length + 1}`,
    url,
    outlet: String(msg.from_email).split('@')[1] || msg.from_email,
    title,
    publishedAt: msg.received_at || nowISO(),
    primary: true,
    kind: 'email',
    addedAt: nowISO(),
    text: String(msg.body || '').slice(0, MAX_SOURCE_CHARS),
    readAt: nowISO(),
  };
  d.sources.push(src);
  return src;
}

async function classifyMessage(d, msg) {
  const { data } = await chatJSON('desk', [
    {
      role: 'system',
      content: `You read replies to an investigative desk. You record only what the sender wrote — never what you assume they meant. A denial is a finding, not an obstacle. Return JSON only.`,
    },
    {
      role: 'user',
      content: `WE ASKED: ${d.title}
OUR QUESTION: ${d.angle}

FROM: ${msg.from_email}
SUBJECT: ${msg.subject || '(none)'}
MESSAGE:
${String(msg.body || '').slice(0, 4000)}

TASK
1. kind: one of answer | denial | question | auto-reply | unrelated.
2. summary: two sentences, what the sender actually said.
3. claims: facts the sender states that we can use, one per line, with their exact numbers and dates. Only what they wrote. If they deny something, phrase it as their denial.
4. gaps: what they did not answer or what their reply makes newly unclear.
5. needs_reply: true only if they ask us something or a short acknowledgement is due.
6. reply: if needs_reply, a formal German or English answer in plain text, max 150 words, signed "PLAIN. Investigative desk", stating again that the research is AI-assisted and editor-reviewed. Otherwise empty.

Return {"kind":"…","summary":"…","claims":["…"],"gaps":["…"],"needs_reply":false,"reply":""}`,
    },
  ], { temperature: 0.2, maxTokens: 1600 });

  return {
    kind: ['answer', 'denial', 'question', 'auto-reply', 'unrelated'].includes(data.kind) ? data.kind : 'answer',
    summary: String(data.summary || '').slice(0, 1000),
    claims: (Array.isArray(data.claims) ? data.claims : []).map(String).filter((s) => s.trim().length > 20).slice(0, 8),
    gaps: (Array.isArray(data.gaps) ? data.gaps : []).map(String).filter(Boolean).slice(0, 5),
    needsReply: Boolean(data.needs_reply),
    reply: String(data.reply || '').trim(),
  };
}

const replySubject = (subject) => {
  const value = String(subject || '').trim() || 'Ihre Auskunft';
  return /^re:/i.test(value) ? value.slice(0, 160) : `Re: ${value}`.slice(0, 160);
};

/**
 * A letter that belongs to no dossier is a tip. The desk reads it in the
 * shift it arrives and keeps what it learned — not the letter, not the
 * address of the sender. A tip that points at something the desk can prove
 * with documents becomes a story it can work on.
 */
async function readLead(state, letter, msg) {
  const body = String(msg.text || letter?.body || '').slice(0, 4000);
  if (!body.trim()) {
    log('INBOX  a letter without a story and without a text — ignored');
    return;
  }
  let parsed = null;
  try {
    const { data } = await chatJSON('desk', [
      {
        role: 'system',
        content: `You read the letters that reach an investigative desk without belonging to a story on file. You write down only what the letter says, never what you assume. You do not repeat private names that are not part of a public matter. You return JSON only.`,
      },
      {
        role: 'user',
        content: `A letter reached the desk:
SUBJECT: ${msg.subject || '(none)'}
MESSAGE:
${body}

TASK
1. summary: two sentences, what the letter is actually about.
2. worth: true only if it points at something a newsroom can prove with public documents or by writing to an institution — a decision, a payment, a transfer, a settlement, a dismissal, an extraction, a breach.
3. story: if worth is true, the story the letter could start — title (max 90 characters), the question it answers, who is affected and who profits, and 4-6 search queries that would find the documents. If worth is false, leave it empty.

Return {"summary":"…","worth":false,"story":{"title":"","angle":"","people":"","queries":[]}}`,
      },
    ], { temperature: 0.2, maxTokens: 1200 });
    parsed = data;
  } catch (err) {
    log(`INBOX  tip not read: ${err.message}`);
    return;
  }

  const story = parsed?.story || {};
  const lead = {
    at: nowISO(),
    summary: String(parsed?.summary || '').slice(0, 400),
    worth: Boolean(parsed?.worth) && String(story.title || '').length > 10,
    title: String(story.title || '').slice(0, 120),
    angle: String(story.angle || '').slice(0, 300),
    people: String(story.people || '').slice(0, 300),
    queries: (Array.isArray(story.queries) ? story.queries : []).map(String).filter((q) => q.length > 5).slice(0, 6),
  };
  if (!lead.summary) return;
  state.leads = Array.isArray(state.leads) ? state.leads : [];
  state.leads = [lead, ...state.leads.filter((l) => l.summary !== lead.summary)].slice(0, 20);
  log(`INBOX  tip ← ${msg.from} — ${lead.worth ? 'could be a story' : 'kept on the list'}`);
  await markMessages([letter?.id].filter(Boolean), { status: 'processed', processed_at: nowISO() }).catch(() => {});
}

/**
 * The desk reads the front pages of the cabinets it follows. A reporter does
 * not wait for a tip to open the day's notices — they look at what the world
 * published and decide what deserves documents and questions. Once a day the
 * desk does that and keeps the stories it can prove.
 *
 * The notices are the point: a story the desk starts on its own begins with a
 * document it can read, not with a headline it has to hope for.
 */
async function scanForLeads(state, dossiers) {
  const today = nowISO().slice(0, 10);
  if (state.lastScan === today) return 0;
  // A scan that eats the shift leaves the story on the desk unworked. The
  // notices will be there tomorrow.
  if (deadlineLeft() < 180000) {
    log('SCAN  not enough time left in this shift');
    return 0;
  }

  const items = await safe(() => cabinetFrontPage({ limit: 36 }), []);
  if (!items.length) {
    log('SCAN  nothing on the front pages of the cabinets today');
    return 0;
  }

  const noticesOf = (subset) =>
    subset
      .map((it, i) => `#${i + 1} [${it.outlet}] ${String(it.title || '').replace(/\s+/g, ' ').slice(0, 220)}\n${it.url}`)
      .join('\n\n');

  const ask = async (subset, options) => {
    const { data } = await chatJSON('desk', [
      {
        role: 'system',
        content: `You are the investigative editor of PLAIN. Every morning you read what the institutions you follow have published and you decide which of it deserves an investigation: documents, data and questions, weeks of work. The desk works internationally — a notice about one country's own affairs is not the desk's story unless a cross-border institution, money or people are involved, and Switzerland is where the paper is published, not what it covers. You write about people: a notice without anyone who loses something, profits or lives with the consequences is a procedure, not a story. Return JSON only.`,
      },
      {
        role: 'user',
        content: `What the institutions published today:\n\n${noticesOf(subset)}\n\nPick at most three notices that could start an investigation. A notice qualifies only if ALL of these hold:
- it points at something concrete: a decision, a payment, an award, a charge, a settlement, a seizure, a sanction, a contract;
- it is answerable with public documents and questions to the institutions — no hidden sources needed;
- it has people in it: who is affected, who profits, who is left with the consequences;
- it crosses a border, or it involves an international institution, money or people moving between countries;
- it is not a subject the desk already has.

For each pick write the story it could start: a working headline (max 90 characters), the question the investigation answers, the country or region it is really about, who is affected and who profits, and 4-6 search queries in the language of the source that would find the documents around it. Never write about a notice that is not in the list.

What the desk already has (its own memory — a new piece must not repeat it):
${memoryBlock(deskMemory(dossiers, state)) || '(nothing yet — this would be the first piece)'}

Return {"leads":[{"n":1,"summary":"one sentence on what the notice says","worth":true,"title":"…","angle":"…","centre":"…","people":"…","category":"politics|business|world|tech|science|climate|health|culture|sport","queries":["…"]}]}. "n" is the number of the notice in the list above. Return {"leads":[]} if nothing qualifies.`,
      },
    ], options);
    return (Array.isArray(data?.leads) ? data.leads : []).slice(0, 3);
  };

  // The desk's whole day of leads hangs on one answer. A model that writes
  // its reasoning into the reply instead of the JSON ("We need to output JSON
  // with leads array…") cost the desk a scan in production — it does not get
  // to cost the whole day: fewer notices, cooler, more room to answer.
  let shelf = items;
  let picks = [];
  try {
    picks = await ask(items, { temperature: 0.35, maxTokens: 2400, numCtx: 32768, timeoutMs: 120000 });
  } catch (err) {
    log(`SCAN  the desk could not read the front pages: ${err.message}`);
    shelf = items.slice(0, 12);
    if (shelf.length === items.length) return 0;
    log(`SCAN  second pass over ${shelf.length} notices`);
    try {
      picks = await ask(shelf, { temperature: 0.1, maxTokens: 3000, numCtx: 32768, timeoutMs: 120000 });
    } catch (err2) {
      log(`SCAN  second pass failed too: ${err2.message}`);
      return 0;
    }
  }

  let added = 0;
  for (const pick of picks) {
    const item = shelf[Number(pick?.n) - 1];
    const worth = pick?.worth === true || pick?.worth === 'true' || pick?.worth === 1;
    if (!item || !worth || String(pick.title || '').length < 12) continue;
    // A notice that names nothing cannot support a story. The desk's first
    // scan turned an empty "Contract Award: " into "$200M for renewable
    // energy in Kenya" — the notice itself was a Kyrgyz road project. The
    // pick is not filed: there is no document to check the story against.
    const docTitle = String(item.title || '').replace(/\s+/g, ' ').trim();
    if (docTitle.replace(/[^A-Za-z]/g, '').length < 20) {
      log(`SCAN  ✗ notice names nothing: ${docTitle || '(no title)'}`);
      continue;
    }
    const lead = {
      at: nowISO(),
      origin: 'scan',
      summary: String(pick.summary || item.title || '').slice(0, 400),
      worth: true,
      title: String(pick.title || '').slice(0, 120),
      angle: String(pick.angle || '').slice(0, 300),
      centre: String(pick.centre || '').trim().slice(0, 80),
      people: String(pick.people || '').slice(0, 300),
      category: pickCategory(pick.category),
      queries: (Array.isArray(pick.queries) ? pick.queries : []).map(String).filter((q) => q.length > 5).slice(0, 6),
      url: item.url,
      outlet: item.outlet,
      docTitle: docTitle.slice(0, 300),
    };
    // The desk works internationally. A notice that turns out to be one
    // country's own business is not filed: the slot is better left empty.
    const gate = leadInternational(lead);
    if (!gate.ok) {
      log(`SCAN  ✗ notice not taken on: ${gate.why} — ${lead.title}`);
      continue;
    }
    state.leads = Array.isArray(state.leads) ? state.leads : [];
    if (state.leads.some((l) => l.url === lead.url)) continue;
    state.leads = [lead, ...state.leads].slice(0, 20);
    added++;
    log(`SCAN  ✓ ${lead.outlet}: ${lead.title}`);
  }
  state.lastScan = today;
  log(`SCAN  ${items.length} notice(s) read, ${added} kept for the desk`);
  return added;
}

/**
 * The desk opens its own mailbox at the start of the shift. What comes in is
 * filed against the dossier whose address it was sent to, so the replies are
 * evidence and not loose mail.
 */
async function pollMailbox(dossiers, state) {
  const host = process.env.IMAP_HOST;
  const user = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;
  if (!host || !user || !password) {
    log('INBOX  no mailbox configured (IMAP_HOST/IMAP_USER/IMAP_PASSWORD) — nothing to read');
    return 0;
  }

  const since = Number(state.mailbox?.lastUid || 0);
  let batch;
  try {
    batch = await withDeadline(
      fetchMail({
        host,
        port: Number(process.env.IMAP_PORT || 993),
        user,
        password,
        sinceUid: since,
        limit: 40,
      }),
      60_000,
      'the desk mailbox'
    );
  } catch (err) {
    log(`INBOX  mailbox not reachable: ${err.message}`);
    return 0;
  }

  let filed = 0;
  let skipped = 0;
  let lastUid = since;
  for (const msg of batch.messages || []) {
    // The desk may share a mailbox with the person who owns the paper. It
    // reads only what is addressed to the desk — everything else is not the
    // desk's mail and never reaches the database.
    if (!addressedToDesk(msg.to)) {
      skipped += 1;
      lastUid = Math.max(lastUid, msg.uid);
      continue;
    }
    const slug = slugFromAddress(msg.to);
    // Only a reply that belongs to a dossier on file can be filed against one.
    const known = slug && dossiers.some((d) => d.slug === slug) ? slug : null;
    try {
      const letter = await recordInbound({
        slug: known,
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        messageId: msg.messageId,
        inReplyTo: msg.inReplyTo,
        // A letter that belongs to no dossier is not filed in the desk's
        // mailbox: it is read right here, and the desk keeps what it learned.
        store: Boolean(known),
      });
      filed += 1;
      lastUid = Math.max(lastUid, msg.uid);
      if (known) {
        log(`INBOX  ${known} ← ${msg.from} — ${msg.subject.slice(0, 70)}`);
      } else {
        await readLead(state, letter, msg);
      }
    } catch (err) {
      // The message stays unfiled, so it is picked up again next shift.
      log(`INBOX  could not file ${msg.from}: ${err.message}`);
      break;
    }
  }

  state.mailbox = { lastUid, at: nowISO() };
  if (skipped) log(`INBOX  ${skipped} message(s) not addressed to the desk — left alone`);
  return filed;
}

async function readInbox(d) {
  let messages = [];
  try {
    messages = await withDeadline(listMessages({ slug: d.slug, status: 'new', limit: 5 }), 12_000, 'the desk mailbox');
  } catch (err) {
    log(`INBOX  ${d.slug}: ${err.message}`);
    return 0;
  }
  if (!messages.length) return 0;

  const rows = (await outreachRows(d).catch(() => []))
    .filter((r) => ['sent', 'replied'].includes(r.status));
  const handled = [];

  for (const msg of messages) {
    if (deadlineLeft() < 120_000) {
      log('INBOX  deadline close — leaving the rest for the next run');
      break;
    }
    const parsed = await classifyMessage(d, msg).catch((err) => {
      log(`INBOX  classify failed (${msg.from_email}): ${err.message}`);
      return null;
    });
    if (!parsed) continue;

    // Anyone can write to the desk address. Only a reply to a request we
    // actually sent counts as evidence; everything else is a lead.
    const row = rows.find((r) => String(r.to_email || '').toLowerCase() === String(msg.from_email).toLowerCase());
    if (!row) {
      const gap = `Unverlangte Mail von ${msg.from_email}: ${parsed.summary.slice(0, 220)}`;
      if (!d.gaps.some((g) => g.toLowerCase() === gap.toLowerCase())) d.gaps.push(gap);
      note(d, null, `mail from ${msg.from_email} (lead, no request on file)`);
      handled.push(msg.id);
      continue;
    }

    const src = addEmailSource(d, msg);
    for (const text of parsed.claims) {
      if (d.claims.some((c) => c.text.toLowerCase() === text.toLowerCase())) continue;
      d.claims.push({
        id: `C${d.claims.length + 1}`,
        text: text.slice(0, 600),
        sources: [src.id],
        status: parsed.kind === 'denial' ? 'contested' : 'verified',
        weight: 3,
        checkedAt: nowISO(),
      });
    }
    for (const gap of parsed.gaps) {
      if (!d.gaps.some((g) => g.toLowerCase() === gap.toLowerCase())) d.gaps.push(gap.slice(0, 300));
    }

    await setOutreach([row.id], { status: 'replied', reply_note: parsed.summary.slice(0, 1000) }).catch(() => {});

    if (parsed.needsReply && parsed.reply.length > 80) {
      const subject = replySubject(msg.subject);
      const body = withDisclosure(parsed.reply);
      // The desk keeps its own copy of what it wants to answer. A reply that
      // only lives on the shelf is lost on the day the shelf does not answer.
      const letter = {
        id: nextLetterId(d),
        to_email: msg.from_email,
        org: row?.org || msg.from_email,
        status: 'draft',
        subject,
        body,
        reply_note: `Reply to the mail of ${msg.subject}`.slice(0, 200),
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      ledger(d).push(letter);
      await addOutreach([{
        slug: d.slug,
        toEmail: msg.from_email,
        org: letter.org,
        subject,
        body,
      }]).then((added) => {
        const row2 = Array.isArray(added) ? added[0] : null;
        if (row2?.id) letter.dbId = row2.id;
      }).catch((err) => log(`INBOX  reply draft not on the shelf: ${err.message}`));
    }

    note(d, null, `mail from ${msg.from_email} (${parsed.kind})`);
    handled.push(msg.id);
  }

  if (handled.length) {
    await markMessages(handled, { status: 'processed', processed_at: nowISO() }).catch(() => {});
  }
  log(`INBOX  ${handled.length}/${messages.length} message(s) processed`);
  return handled.length;
}

// A desk that publishes on trust is not a desk. Before anything is written or
// asked, every claim is read back against the text it cites: what the document
// does not say leaves the dossier.
async function factcheck(d) {
  const checkable = d.claims.filter(
    (c) => !c.checked && (c.sources || []).some((id) => (d.sources.find((s) => s.id === id)?.text || '').length >= 300),
  );
  const unreadable = d.claims.filter((c) => !c.checked && !checkable.includes(c));
  for (const c of unreadable) c.checked = 'unreadable'; // headline only — cannot be read back
  if (!checkable.length) return;
  if (deadlineLeft() < 150_000) {
    log('CHECK  deadline close — claims left unchecked');
    return;
  }

  const batch = checkable.slice(0, 8);
  const pack = batch.map((c) => {
    const texts = c.sources
      .map((id) => d.sources.find((s) => s.id === id))
      .filter((s) => s?.text)
      .slice(0, 2)
      .map((s) => `[${s.id}] ${s.outlet} — ${s.title}\n${s.text.slice(0, 1800)}`)
      .join('\n\n');
    return `[${c.id}] CLAIM: ${c.text}\n${texts}`;
  }).join('\n\n────────\n\n');

  let data;
  try {
    ({ data } = await chatJSON('desk', [
      {
        role: 'system',
        content: 'You are the fact-checker of an investigative desk. You compare a claim with the source text it cites. You do not judge plausibility and you do not use outside knowledge: if the text does not carry the claim, the verdict is unsupported. Return JSON only.',
      },
      {
        role: 'user',
        content: `For each claim below, decide against the quoted source text:
- supported: the text states it, including every number and date.
- partial: the text supports the core but not all details, or only one of several citations carries it.
- unsupported: the text does not say it, says something else, or is about a different entity.

${pack}

Return {"checks":[{"id":"C1","verdict":"supported|partial|unsupported","reason":"one sentence, quote the sentence that decides it"}]}`,
      },
    ], { temperature: 0, maxTokens: 1600 }));
  } catch (err) {
    log(`CHECK  failed: ${err.message}`);
    return;
  }

  const verdicts = new Map((Array.isArray(data.checks) ? data.checks : []).map((c) => [String(c.id), c]));
  const dropped = [];
  for (const c of batch) {
    const v = verdicts.get(c.id);
    if (!v) continue;
    const verdict = ['supported', 'partial', 'unsupported'].includes(v.verdict) ? v.verdict : 'partial';
    c.checked = verdict;
    if (verdict === 'partial') c.checkNote = String(v.reason || '').slice(0, 240);
    if (verdict === 'unsupported') dropped.push(c);
  }

  if (dropped.length) {
    const keep = new Set(dropped.map((c) => c.id));
    d.claims = d.claims.filter((c) => !keep.has(c.id));
    d.dropped = [...(d.dropped || []), ...dropped.map((c) => ({ text: c.text, why: c.checkNote || 'nicht belegt' }))].slice(-40);
    for (const c of dropped) d.gaps.push(`Nicht belegt, deshalb gestrichen: ${c.text.slice(0, 200)}`);
    log(`CHECK  ${dropped.length} claim(s) dropped — the cited text does not carry them`);
  }
  log(`CHECK  ${batch.length - dropped.length}/${batch.length} claim(s) stand`);
}

async function research(d) {
  pruneOffTopic(d);
  if (process.env.INVESTIGATE_AGENT !== '0') {
    const ok = await researchAgent(d).catch((err) => {
      log(`RESEARCH  agent failed: ${err.message}`);
      return false;
    });
    if (ok) return;
    log('RESEARCH  agent produced nothing — falling back to the feed pass');
  }
  await ensureQueries(d);

  // Rotate the window so a dossier with more than five queries uses all of them
  // over several days instead of hammering the same five every run.
  const size = Math.min(5, d.queries.length);
  const start = ((d.researchRuns || 0) * size) % d.queries.length;
  const picked = Array.from({ length: size }, (_, i) => d.queries[(start + i) % d.queries.length]);
  d.researchRuns = (d.researchRuns || 0) + 1;
  const feeds = [
    ...picked.flatMap((q) => [
      { outlet: `Search: ${q}`, url: googleNews(q), kind: 'aggregator' },
      { outlet: `Bing: ${q}`, url: bingNews(q), kind: 'bing' },
    ]),
    ...HOME_FEEDS,
  ];
  const { items, feedsOk } = await safe(() => fetchFeeds(feeds, { maxAgeHours: 24 * 45, perFeed: 25 }), { items: [], feedsOk: 0 });
  log(`RESEARCH  ${d.slug}: ${items.length} hits from ${feedsOk} search feed(s)`);

  const kw = keywordsOf(d);
  d.keywords = kw;
  // One keyword is not a match: a passing mention is not the story. Two terms,
  // or one term on a document from an official body, before an item may enter.
  // And it has to carry a word from this story's own title.
  const core = coreTermsOf(d);
  const relevant = items
    .map((it) => ({ it, hits: keywordHits(`${it.title} ${it.summary}`, kw), core: keywordHits(`${it.title} ${it.summary}`, core) }))
    .filter((x) => x.core >= 1 && (x.hits >= 2 || (x.hits >= 1 && isPrimaryOutlet(x.it.outlet))))
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.it);

  let added = 0;
  for (const it of relevant.slice(0, 20)) if (addSource(d, it)) added++;

  // Tips from the reader may contain documents or links worth reading.
  for (const url of String(d.brief?.hints || '').match(/https?:\/\/\S+/g) || []) {
    if (addSource(d, { url, outlet: 'Reader tip', title: 'Document from reader wish', publishedAt: null }, { kind: 'tip' })) added++;
  }
  log(`RESEARCH  ${added} new source(s), ${d.sources.length} total`);

  const unread = d.sources.filter((s) => !s.readAt && s.url);
  const toRead = unread.slice(0, MAX_READS);
  await pool(toRead, 3, async (s) => {
    const details = await fetchArticleDetails(s.url, MAX_SOURCE_CHARS).catch(() => null);
    s.readAt = nowISO();
    if (details?.text) s.text = details.text.slice(0, MAX_SOURCE_CHARS);
    if (details?.image) {
      s.image = details.image;
      s.imageCaption = details.imageCaption;
      s.imageCredit = details.imageCredit;
    }
  });

  if (d.sources.length) await extract(d);
  if (d.status === 'pitch' && d.sources.length >= 3) {
    note(d, 'research', `${d.sources.length} sources`);
  }
  d.nextStep = 'read sources, extract claims, find contacts';
}

function sourcePack(d, limit = 8, chars = 3500) {
  // The documents first: a document that was opened carries facts, a headline
  // that was not opened carries none. Without this order the pack fills up
  // with unread headlines and the strongest material never reaches the model.
  const ordered = [
    ...d.sources.filter((s) => s.primary && s.text),
    ...d.sources.filter((s) => !s.primary && s.text),
    ...d.sources.filter((s) => !s.text),
  ];
  return ordered.slice(0, limit).map((s) =>
    `[${s.id}] ${s.outlet}${s.primary ? ' (official/primary)' : ''} — "${s.title}" (${String(s.publishedAt || '').slice(0, 10)})\nURL: ${s.url}\nTEXT: ${(s.text || '(not readable — headline only)').slice(0, chars)}`
  ).join('\n\n');
}

async function extract(d) {
  const existing = d.claims.map((c) => `[${c.id}] (${c.status}) ${c.text} — sources: ${(c.sources || []).join(', ')}`).join('\n');
  const { data, model } = await chatJSON('desk', [
    {
      role: 'system',
      content: `You are the research desk of an investigative newsroom. You extract only what the sources say. You never add facts from memory. Return JSON only.`,
    },
    {
      role: 'user',
      content: `INVESTIGATION: ${d.title}\nQUESTION: ${d.angle}\n

SOURCES:
${sourcePack(d)}

CLAIMS ALREADY ON FILE:
${existing || '(none)'}

TASK: Build the evidence base.
1. claims: every factual finding that matters — who decided what, how much money, which contract, which date, who benefited, which rule applied or was bypassed, and where sources contradict each other (one claim, both versions, both source ids). Merge duplicates with the claims on file. Keep only claims a source directly supports.
2. gaps: what is still unknown and must be asked or found (documents, figures, names, decisions). Be concrete.
3. contacts: institutions, companies and people who must be asked for comment, and why. No email addresses — the editor supplies the recipient in the admin desk.

Return exactly:
{"claims":[{"id":"C1","text":"…","sources":["S1","S2"],"status":"verified|contested","weight":1}],"gaps":["…"],"contacts":[{"org":"…","why":"why they must answer"}]}`,
    },
  ], {
    temperature: 0.2,
    maxTokens: 8000,
    // Writing down what was found must not wait for the next shift: the desk
    // gets up to five minutes for it and may run two minutes past the end of
    // its own shift. A finding nobody wrote down is a finding lost.
    deadline: Date.now() + Math.min(Math.max(Number.isFinite(deadlineLeft()) ? deadlineLeft() : 240_000, 0) + 120_000, 300_000),
    timeoutMs: 180_000,
  });

  const validIds = new Set(d.sources.map((s) => s.id));
  const claims = (Array.isArray(data.claims) ? data.claims : [])
    .map((c, i) => ({
      id: `C${i + 1}`,
      text: String(c.text || '').trim().slice(0, 600),
      sources: [...new Set((c.sources || []).map(String).filter((id) => validIds.has(id)))],
      status: c.status === 'contested' ? 'contested' : 'verified',
      weight: Math.min(5, Math.max(1, Number(c.weight) || 2)),
      checkedAt: nowISO(),
    }))
    .filter((c) => c.text.length > 20 && c.sources.length > 0);

  if (!claims.length) {
    log('RESEARCH  extraction produced no supported claims');
    return;
  }
  // The extraction adds to what is on file; it never replaces a claim the
  // agent already made. Identifiers stay stable so a draft keeps its grip.
  const existingIds = new Set(d.claims.map((c) => c.id));
  const merged = [...d.claims];
  let next = d.claims.length + 1;
  for (const c of claims) {
    const norm = c.text.toLowerCase().replace(/\W+/g, ' ').trim();
    if (merged.some((x) => x.text.toLowerCase().replace(/\W+/g, ' ').trim() === norm)) continue;
    let id = `C${next++}`;
    while (existingIds.has(id)) id = `C${next++}`;
    existingIds.add(id);
    merged.push({ ...c, id });
  }
  d.claims = merged;
  d.gaps = [...new Set([...(d.gaps || []), ...(Array.isArray(data.gaps) ? data.gaps : []).map(String)])].slice(0, 12);
  for (const c of Array.isArray(data.contacts) ? data.contacts : []) {
    const org = String(c.org || '').trim();
    if (!org || d.contacts.some((x) => sameOrg(x.org, org))) continue;
    d.contacts.push({ org, role: String(c.why || 'must be asked for comment').slice(0, 300) });
  }
  log(`RESEARCH  ${d.claims.length} claim(s), ${d.gaps.length} gap(s), ${d.contacts.length} contact(s) — ${model}`);
}

// ─────────────────────────── 3. OUTREACH ───────────────────────────
// Two entries can name the same organisation: "Bitget Exchange" and
// "Bitget - Security Team" are one desk, and a real one asks once.
const ORG_NOISE = new Set([
  'company', 'exchange', 'group', 'team', 'firm', 'labs', 'agency', 'security',
  'media', 'press', 'office', 'department', 'center', 'centre', 'authority',
  'authorities', 'commission', 'ministry', 'council', 'bank', 'united', 'nation',
  'national', 'global', 'world', 'blockchain', 'crypto', 'digital', 'services',
  'systems', 'technology', 'technologies', 'holdings', 'partners', 'associates',
  'ltd', 'inc', 'gmbh', 'plc', 'corp', 'and', 'the', 'for', 'similar',
  'relevant', 'must', 'asked', 'comment', 'organization', 'organisation',
  'institution', 'official', 'response', 'investigation', 'unit', 'bureau',
  'issuer', 'issuers',
]);
function orgTokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[()[\]]/g, ' ')
    .replace(/\b(e\.?g\.?|i\.?e\.?|etc\.?)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w.length >= 4 && !ORG_NOISE.has(w))
    .map(stem);
}
function stem(w) {
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}
function sameOrg(a, b) {
  if (String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()) return true;
  const ta = orgTokens(a);
  const tb = orgTokens(b);
  if (!ta.length || !tb.length) return false;
  // The name an organisation is known by sits at the front. A shared word
  // further back ("Bitget is registered in ...") is not the same desk.
  const coreA = new Set([...ta].slice(0, 3));
  const coreB = new Set([...tb].slice(0, 3));
  for (const t of coreA) if (t.length >= 5 && coreB.has(t)) return true;
  for (const t of coreB) if (t.length >= 5 && coreA.has(t)) return true;
  return false;
}

// The desk's own ledger of the letters it owes.
//
// A letter lives in the dossier, not only in the database. The shared shelf
// may be unreachable for days, and a desk that cannot write down its own
// questions is not a desk. The row in the database is a mirror of the
// ledger, not its memory.
function ledger(d) {
  if (!Array.isArray(d.letters)) d.letters = [];
  return d.letters;
}

function nextLetterId(d) {
  const used = new Set(ledger(d).map((l) => l.id));
  let n = ledger(d).length + 1;
  while (used.has(`L${n}`)) n += 1;
  return `L${n}`;
}

const DB_FIELDS = ['subject', 'body', 'status', 'approved_by', 'approved_at', 'sent_at', 'error', 'reply_note'];

function letterRow(d, letter) {
  return {
    id: letter.id,
    dbId: letter.dbId ?? null,
    slug: d.slug,
    to_email: letter.to_email || '',
    org: letter.org || null,
    contact_name: letter.contact_name || null,
    subject: letter.subject || '',
    body: letter.body || '',
    status: letter.status || 'requested',
    approved_by: letter.approved_by || null,
    approved_at: letter.approved_at || null,
    sent_at: letter.sent_at || null,
    error: letter.error || null,
    reply_note: letter.reply_note || null,
    reminds: letter.reminds || null,
    created_at: letter.created_at || null,
  };
}

/** Writes a change into the ledger and, where there is a row, into the shelf. */
async function saveLetter(d, row, patch) {
  const letter = ledger(d).find((l) => l.id === row.id);
  if (letter) Object.assign(letter, patch, { updated_at: nowISO() });
  if (row.dbId) {
    const dbPatch = {};
    for (const field of DB_FIELDS) if (patch[field] !== undefined) dbPatch[field] = patch[field];
    if (Object.keys(dbPatch).length) {
      await setOutreach([row.dbId], dbPatch).catch((err) => log(`OUTREACH  shelf not updated: ${err.message}`));
    }
  }
}

// A letter that went out stays out. Every other state may be taken back from
// the shelf, because that is where the editor decides.
const SENT_STATES = ['sent', 'replied'];

async function outreachRows(d) {
  const rows = await safe(() => listOutreach({ limit: 300 }), []);
  const letters = ledger(d);
  const byMail = new Map();
  for (const l of letters) {
    const mail = String(l.to_email || '').toLowerCase();
    if (!byMail.has(mail)) byMail.set(mail, l);
  }
  const out = letters.map((l) => letterRow(d, l));

  for (const row of rows.filter((r) => r.slug === d.slug)) {
    const mail = String(row.to_email || '').toLowerCase();
    // A shelf row belongs to the letter that wrote it. Two letters to the
    // same address — the first request and the reminder — are two rows.
    const known =
      letters.find((l) => l.dbId != null && l.dbId === row.id) ||
      letters.find((l) => l.dbId == null && String(l.to_email || '').toLowerCase() === mail) ||
      byMail.get(mail);
    if (!known) {
      // A recipient the editor queued while the ledger did not know him.
      const letter = {
        id: nextLetterId(d),
        dbId: row.id,
        to_email: row.to_email || '',
        org: row.org || null,
        contact_name: row.contact_name || null,
        subject: row.subject || '',
        body: row.body || '',
        status: row.status || 'requested',
        reply_note: row.reply_note || null,
        approved_by: row.approved_by || null,
        approved_at: row.approved_at || null,
        sent_at: row.sent_at || null,
        error: row.error || null,
        created_at: row.created_at || null,
      };
      letters.push(letter);
      byMail.set(mail, letter);
      out.push(letterRow(d, letter));
      continue;
    }
    // The editor's shelf has the last word, except for a letter that is
    // already out of the house.
    if (!known.dbId) known.dbId = row.id;
    if (row.status && row.status !== known.status && !SENT_STATES.includes(known.status)) {
      known.status = row.status;
    }
    for (const field of DB_FIELDS) {
      if (field === 'status') continue;
      if (row[field] != null && row[field] !== '') known[field] = row[field];
    }
    const mine = out.find((o) => o.id === known.id);
    if (mine) Object.assign(mine, letterRow(d, known));
  }
  return out;
}

function replyDeadline() {
  const d = new Date(Date.now() + 5 * 864e5);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// How the research was made belongs in every letter the desk sends. It is
// not left to the model: a letter that goes out without it would hide how
// the work was done.
const DISCLOSURE = 'This research is AI-assisted. Every text is reviewed by a human editor before it is published.';

function withDisclosure(body) {
  const text = String(body || '').trim();
  if (!text) return text;
  if (/ai-assisted|ai assisted|ki-gestützt|editor-reviewed|machine-assisted/i.test(text)) return text;
  return `${text}\n\n${DISCLOSURE}`;
}

async function draftEmail(d, { org, note: hint, reminder }) {
  const claims = [...d.claims].sort((a, b) => b.weight - a.weight).slice(0, 6)
    .map((c) => `- ${c.text}`).join('\n');
  // The open questions are what the desk still cannot answer. A reporter
  // writes to a party to close them — the letter has no other reason to exist.
  const open = (d.gaps || []).slice(0, 8).map((g) => `- ${String(g).slice(0, 200)}`).join('\n');
  const rules = reminder
    ? `- This is a reminder, not a new request: we wrote to ${org} on ${reminder.sentDay} with the subject "${reminder.subject || 'our request for comment'}" and have had no answer.
- Two short paragraphs: what we are waiting for, and that we would still like to publish their reply.
- Say once that the research is AI-assisted and editor-reviewed.
- Ask for an answer by ${replyDeadline()}.
- Sign: PLAIN. Investigative desk, ${EDITORIAL_EMAIL}
- No accusations, no legal threats, no flattery, no emojis, no markdown. Plain text, at most 120 words.`
    : `- Greeting: formal, to the organisation (no invented names).
- One neutral paragraph: who we are (PLAIN., investigative desk, plain-news.ch), that this research is AI-assisted and editor-reviewed, and what we are looking into.
- 3-5 numbered questions. Each must be answerable and about one specific fact, payment, decision or date from the list above, or must close one of the open questions.
- Do not ask the organisation whether it knows of the matter, whether it has received complaints, lawsuits or reports about it, or what its position on the matter is, unless the list above says so.
- Say we will publish their reply; they may choose full or summarized.
- Offer to correct anything factually wrong.
- Ask for an answer by ${replyDeadline()}.
- Sign: PLAIN. Investigative desk, ${EDITORIAL_EMAIL}
- No accusations, no legal threats, no flattery, no emojis, no markdown. Plain text, at most 280 words.`;
  const { data } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You draft formal source requests for the investigative desk of PLAIN. (${SITE.url}), an independent, advertising-free Swiss news site that reports internationally; write in the language of the recipient (English for international bodies). The research is AI-assisted and every text is reviewed by a human editor — say so openly. Never accuse. Never negotiate. Return JSON only.`,
    },
    {
      role: 'user',
      content: `We are investigating: ${d.title}
Our question: ${d.angle}
What our documents and reports currently show (each line is sourced, do not overstate):
${claims}${open ? `\nWhat we could not find out and would like to ask about:\n${open}` : ''}

Write an email to: ${org}${hint ? `\nInternal note from the editor: ${hint}` : ''}

RULES
${rules}

Return {"subject":"…","body":"…"}`,
    },
  ], { temperature: 0.3, maxTokens: 1200 });

  const subject = String(data.subject || '').trim().slice(0, 160);
  const body = withDisclosure(String(data.body || '').trim());
  if (!subject || body.length < 200) throw new Error('email draft too thin');
  return { subject, body };
}

/**
 * The domains an institution publishes from. A news site is not one of them,
 * even when its name carries a word like "court".
 */
function institutionHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!h) return false;
  if (/(^|\.)(gov|mil|int|edu|gouv)$/.test(h)) return true;
  if (/(^|\.)(gov|gc)\.[a-z]{2}$/.test(h)) return true;
  if (/(^|\.)europa\.eu$/.test(h)) return true;
  return /(^|\.)(un|worldbank|imf|oecd|unicef|unido|icj-cij|icc-cpi|worldhealth)\.[a-z]{2,4}$/.test(h);
}

/**
 * Is this source about the story? The desk asks the same question twice: once
 * when it throws away a source it read, and once before it writes to the
 * institution that filed it. A document that names the story, or says two of
 * its words, is about it. A document nothing has been read from yet is left
 * alone — the desk filed it for this story in the first place.
 */
function sourceIsAboutStory(d, source) {
  const { terms } = storyVocabulary(d);
  const vocabulary = terms;
  if (!vocabulary.length) return true;
  const title = String(source?.title || '');
  const text = String(source?.text || '');
  if (!title && !text) return true;
  if (vocabulary.some((re) => re.test(title))) return true;
  return vocabulary.filter((re) => re.test(text)).length >= 2;
}

/**
 * The domain an address belongs to. A letter to press@justice.gov goes to
 * justice.gov — the institution that filed the document.
 */
function mailHost(email) {
  const at = String(email || '').split('@')[1] || '';
  return at.trim().toLowerCase().replace(/^www\./, '');
}

/**
 * Is this organisation named in what the desk knows about the story? The
 * frame the desk wrote, the claims it made, the questions it could not
 * answer, and the documents it read that are about the story. An
 * organisation that appears nowhere in it is not a party to the story.
 */
function orgIsInStory(d, org) {
  const brief = d.brief || {};
  const record = [
    d.title,
    d.angle,
    brief.topic,
    brief.why,
    brief.centre,
    brief.beat,
    brief.people,
    brief.border,
    brief.hints,
    ...(d.queries || []),
    ...(d.claims || []).map((c) => c.text),
    ...(d.gaps || []),
    ...(d.sources || []).filter((s) => sourceIsAboutStory(d, s)).flatMap((s) => [s.title, s.text]),
  ]
    .filter(Boolean)
    .join('\n');
  // A desk that knows nothing yet does not judge: it waits.
  if (!record.trim()) return true;
  const tokens = [
    ...new Set(
      String(org || '')
        .toLowerCase()
        .replace(/[()[\]]/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(' ')
        .filter((w) => w.length >= 5 && !BOILERPLATE.has(w) && !STOPWORDS.has(w) && !GENERIC.has(w))
    ),
  ];
  if (!tokens.length) return false;
  return tokens.some((w) => wordPattern(w).test(record));
}

/**
 * Does the story call for a letter to this organisation? Either the desk
 * holds a document from the organisation and that document is about the
 * story, or the story names the organisation itself. A letter to anybody else
 * is a letter to somebody the story does not concern.
 */
function contactIsAboutStory(d, contact) {
  const org = String(contact?.org || '');
  const email = String(contact?.email || '');
  if (!org.trim() && !email.trim()) return false;
  const hosts = new Set();
  const mail = mailHost(email);
  if (mail) hosts.add(mail);
  const page = hostOf(contact?.emailSource || '');
  if (page && page !== 'unknown') hosts.add(page);
  const own = (d.sources || []).filter(
    (s) => hosts.has(hostOf(s.url)) || (org.trim() && sameOrg(s.outlet, org)),
  );
  if (own.length) return own.some((s) => sourceIsAboutStory(d, s));
  return orgIsInStory(d, org);
}

/**
 * The desk knows who to write to: every document it holds comes from an
 * institution, and an institution publishes its press address. The agent does
 * not have to spend a step on it — a reporter who read the document knows
 * whose desk to write to.
 *
 * A letter goes to an institution the story is about. A document the desk
 * opened and found to be about something else earns no letter: a reporter
 * does not ask the Justice Department about a game publisher's apology.
 */
async function fileContacts(d) {
  const hosts = [];
  for (const s of d.sources || []) {
    const host = hostOf(s.url);
    if (!host || host === 'unknown' || hosts.includes(host)) continue;
    if (s.kind !== 'document' && !institutionHost(host)) continue;
    hosts.push(host);
  }
  const wanted = hosts.slice(0, 6);
  if (!wanted.length) return 0;
  let added = 0;
  for (const host of wanted) {
    // The addresses on file are worth more than a sixth one: the letter
    // waits behind them.
    if (deadlineLeft() < 30_000) {
      log('OUTREACH  deadline close - the rest of the addresses wait for the next shift');
      break;
    }
    const source = (d.sources || []).find((s) => hostOf(s.url) === host);
    const org = source?.outlet && source.outlet !== 'unknown' ? source.outlet : host;
    // The desk has usually filed the organisation already — without an
    // address. The address is what is missing, not the name.
    const filed = (d.contacts || []).find(
      (c) => !c.email && !c.withdrawn && (sameOrg(c.org, org) || sameOrg(c.org, host)),
    );
    // An organisation the story is not about gets no address. The desk holds
    // a document from it, and that document is about something else — a
    // reporter does not write to the Justice Department about a game
    // publisher's apology.
    const own = (d.sources || []).filter((s) => hostOf(s.url) === host);
    if (!own.some((s) => sourceIsAboutStory(d, s))) continue;
    const found = await publishedEmail(host).catch(() => null);
    if (!found?.email) continue;
    if (filed) {
      filed.email = found.email;
      filed.emailSource = found.sourceUrl;
    } else {
      d.contacts.push({
        org,
        role: 'the institution whose document is on file',
        email: found.email,
        emailSource: found.sourceUrl,
      });
    }
    added++;
  }
  if (added) log(`OUTREACH  ${added} press address(es) read from the institutions' own pages`);
  return added;
}

/**
 * A letter goes to an organisation the story is about. When the desk finds
 * out that it does not, the letter goes back off the editor's desk — before
 * the editor can free it, and before it can be sent.
 */
async function withdrawLetters(d, mail, why) {
  const text = `Withdrawn by the desk: ${why}`;
  for (const l of ledger(d)) {
    if (String(l.to_email || '').toLowerCase() !== mail) continue;
    // A letter that already left the house cannot be taken back.
    if (SENT_STATES.includes(l.status)) continue;
    l.status = 'declined';
    l.withdrawn = true;
    l.error = text;
    l.updated_at = nowISO();
    if (l.dbId) {
      await safe(() => setOutreach([l.dbId], { status: 'declined', error: text }), null);
    }
    log(`OUTREACH  letter ${l.id} to ${mail} withdrawn — ${why}`);
  }
}

/**
 * The recipients the story does not call for. A press address for an
 * institution that filed a document about something else is a letter to
 * somebody the story does not concern; the desk takes it back.
 */
async function pruneContacts(d) {
  const doomed = (d.contacts || []).filter(
    (c) => c.email && !c.withdrawn && !contactIsAboutStory(d, c),
  );
  if (!doomed.length) return 0;
  for (const c of doomed) {
    c.withdrawn = true;
    c.withdrawnWhy = 'the desk holds no document from this organisation about the story, and the story does not name it';
    await withdrawLetters(d, String(c.email || '').toLowerCase(), c.withdrawnWhy);
  }
  log(`OUTREACH  ${doomed.length} recipient(s) withdrawn — the story does not concern them`);
  return doomed.length;
}

async function queueOutreach(d) {
  const rows = await outreachRows(d);
  const known = new Set(rows.map((r) => String(r.to_email || '').toLowerCase()).filter(Boolean));
  const ready = (d.contacts || []).filter(
    (c) => c.email && !c.withdrawn && !known.has(String(c.email).toLowerCase()) && contactIsAboutStory(d, c),
  );
  const queued = [];
  for (const contact of ready.slice(0, 3)) {
    const mail = String(contact.email).toLowerCase();
    // Two entries can carry the same press address. One letter, one ask.
    if (known.has(mail)) continue;
    known.add(mail);
    const letter = {
      id: nextLetterId(d),
      to_email: contact.email,
      org: contact.org || null,
      contact_name: contact.name || null,
      status: 'requested',
      reply_note: contact.emailSource ? `Adresse gefunden auf ${contact.emailSource}` : null,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    ledger(d).push(letter);
    queued.push(letter.org || letter.to_email);
    // The shelf is where the editor works. If it does not answer, the desk
    // keeps the letter in its own ledger.
    try {
      const row = await requestOutreach({
        slug: d.slug,
        toEmail: contact.email,
        org: contact.org,
        note: letter.reply_note,
      });
      letter.dbId = row.id;
    } catch (err) {
      log(`OUTREACH  ${contact.org}: no row in the shared shelf (${err.message}) - the desk keeps its own copy`);
    }
  }
  if (queued.length) {
    note(d, null, `queued ${queued.length} request(s): ${queued.join(', ')}`);
    log(`OUTREACH  queued ${queued.length} request(s) from its own contact list`);
  }
  return queued.length;
}

// A letter that was sent and got no answer is not a closed question. A real
// desk asks again — once, politely — and the editor still holds the button.
const REMINDER_AFTER_DAYS = 12;
const REMINDERS_PER_LETTER = 1;

async function queueReminders(d) {
  const letters = ledger(d);
  const counts = new Map();
  for (const l of letters) if (l.reminds) counts.set(l.reminds, (counts.get(l.reminds) || 0) + 1);
  const due = letters.filter((l) => {
    if (l.status !== 'sent' || !l.sent_at) return false;
    if ((counts.get(l.id) || 0) >= REMINDERS_PER_LETTER) return false;
    const age = (Date.now() - new Date(l.sent_at).getTime()) / 864e5;
    return Number.isFinite(age) && age >= REMINDER_AFTER_DAYS;
  });
  const queued = [];
  for (const letter of due.slice(0, 2)) {
    if (!letter.to_email) continue;
    const sentDay = String(letter.sent_at).slice(0, 10);
    const entry = {
      id: nextLetterId(d),
      to_email: letter.to_email,
      org: letter.org || null,
      contact_name: letter.contact_name || null,
      status: 'requested',
      reminds: letter.id,
      subject: '',
      reply_note: `Reminder: the letter of ${sentDay} is unanswered.`,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    letters.push(entry);
    counts.set(letter.id, (counts.get(letter.id) || 0) + 1);
    try {
      const row = await requestOutreach({ slug: d.slug, toEmail: letter.to_email, org: letter.org, note: entry.reply_note });
      if (row?.id) entry.dbId = row.id;
    } catch (err) {
      log(`OUTREACH  reminder not on the shelf: ${err.message}`);
    }
    queued.push(entry.org || entry.to_email);
  }
  if (queued.length) {
    note(d, null, `reminder(s) prepared: ${queued.join(', ')}`);
    log(`OUTREACH  ${queued.length} reminder(s) prepared for letters without an answer`);
  }
  return queued.length;
}

async function draftOutreach(d) {
  const rows = await outreachRows(d);
  const requested = rows.filter((r) => r.status === 'requested');
  // A reminder is older than the new requests and easier to lose: it goes
  // first.
  const order = [...requested.filter((r) => r.reminds), ...requested.filter((r) => !r.reminds)];
  const drafted = [];

  // The desk writes the text; the editor decides whether it goes out. An
  // address that is not on file is never guessed.
  for (const row of order.slice(0, 3)) {
    const org = row.org || row.to_email;
    try {
      const original = row.reminds ? ledger(d).find((l) => l.id === row.reminds) : null;
      const reminder = original
        ? { sentDay: String(original.sent_at || '').slice(0, 10), subject: original.subject || '' }
        : null;
      const mail = await draftEmail(d, { org, note: row.reply_note || '', reminder });
      await saveLetter(d, row, { ...mail, status: 'draft', error: null });
      drafted.push(org);
      log(`OUTREACH  drafted for ${org}${reminder ? ' (reminder)' : ''}`);
    } catch (err) {
      log(`OUTREACH  draft failed for ${org}: ${err.message}`);
    }
  }

  if (drafted.length) {
    d.outreach = [...(d.outreach || []), ...drafted.map((org) => ({ org, at: nowISO(), status: 'draft' }))].slice(-50);
  }
}

async function sendApproved(d) {
  if (!CAN_SEND) return 0;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    log('OUTREACH  sending skipped: RESEND_API_KEY / RESEND_FROM_EMAIL missing');
    return 0;
  }
  const rows = await outreachRows(d);
  const approved = rows.filter((r) => r.status === 'approved').slice(0, 5);
  let sent = 0;
  for (const row of approved) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.to_email || '')) {
      await saveLetter(d, row, { status: 'failed', error: 'invalid recipient address' });
      continue;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [row.to_email],
          reply_to: deskAddress(d.slug),
          subject: row.subject,
          text: row.body,
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await saveLetter(d, row, { status: 'sent', sent_at: nowISO(), error: null });
      d.outreach = [...(d.outreach || []), { org: row.org || row.to_email, email: row.to_email, at: nowISO(), status: 'sent' }].slice(-50);
      if (d.status === 'research' || d.status === 'pitch') note(d, 'outreach', `request sent to ${row.org || row.to_email}`);
      sent++;
      log(`OUTREACH  ✓ sent to ${row.org || row.to_email}`);
    } catch (err) {
      await saveLetter(d, row, { status: 'failed', error: err.message.slice(0, 300) });
      log(`OUTREACH  ✗ ${row.to_email}: ${err.message}`);
    }
  }
  return sent;
}

/**
 * The editor frees a letter from the desk page. When the shared shelf does
 * not answer, the decision comes with the run instead: it is written into the
 * ledger, the shelf is told when it is reachable, and the desk sends the
 * letter in this same shift.
 */
function parseLetterDecision(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const at = text.indexOf(':');
  if (at < 0) return null;
  const slug = text.slice(0, at).trim();
  const ids = text.slice(at + 1).split(',').map((s) => s.trim()).filter(Boolean);
  if (!slug || !ids.length) return null;
  return { slug, ids };
}

async function applyLetterDecision(d) {
  const decisions = [
    { decision: parseLetterDecision(APPROVE_LETTERS), status: 'approved' },
    { decision: parseLetterDecision(REJECT_LETTERS), status: 'rejected' },
  ];
  for (const { decision, status } of decisions) {
    if (!decision || decision.slug !== d.slug) continue;
    for (const id of decision.ids) {
      const letter = ledger(d).find((l) => l.id === id || (l.dbId != null && String(l.dbId) === id));
      if (!letter) {
        log(`DESK  ${d.slug}: letter ${id} is not on file`);
        continue;
      }
      // A letter the desk has withdrawn does not go out, whatever the editor
      // decides: the desk found out that the story does not concern this
      // organisation.
      if (letter.withdrawn) {
        log(`DESK  ${d.slug}: letter ${id} was withdrawn by the desk - it does not go out`);
        continue;
      }
      const at = nowISO();
      letter.status = status;
      letter.approved_by = APPROVED_BY;
      letter.approved_at = at;
      letter.updated_at = at;
      if (letter.dbId) {
        await safe(() => setOutreach([letter.dbId], { status, approved_by: APPROVED_BY, approved_at: at }));
      }
      note(d, null, `letter ${id} ${status} by ${APPROVED_BY}`);
      log(`DESK  ${d.slug}: letter ${id} ${status} by ${APPROVED_BY}`);
    }
  }
}

// ─────────────────────────── 4. WRITE ───────────────────────────// The text and the claim list are written in two calls. Asked for both in one
// answer, the model spends its budget on the claim list and the piece arrives
// cut off in the middle of its last section.
const DRAFT_SCHEMA = `{"title":"…","dek":"one sentence, max 30 words","standfirst":"2-3 sentences that state what we found and how solid it is","facts":["5-8 key facts with numbers and dates"],"sections":[{"heading":"…","paragraphs":["…"]}]}`;
const CLAIMS_SCHEMA = `{"claims":[{"text":"one fact, one sentence","sources":["S1","S3"]}]}`;

// A long answer can arrive cut off: the model stops at its token limit and
// the last fields are missing. The piece is still worth keeping - the desk
// already wrote a headline for this dossier, and it can stand in for the one
// the model did not finish.
/**
 * How we reported is a fact about the newsroom's work, so the desk writes it
 * from the dossier instead of letting the model describe its own effort.
 */
function applyMethodology(draft, d) {
  if (!draft || typeof draft !== 'object') return draft;
  const sources = d.sources || [];
  const outlets = distinctOutlets(sources).length;
  const primary = sources.filter((x) => x.primary).length;
  const claims = d.claims || [];
  const supported = claims.filter((c) => c.checked === 'supported').length;
  const partial = claims.filter((c) => c.checked === 'partial').length;
  const open = (d.gaps || []).length;
  const parts = [
    `PLAIN. read ${primary} primary documents and reports from ${outlets} outlets for this investigation.`,
    `Every fact in this piece was checked against the text of the source that carries it: ${supported} claims stood, ${partial} rest on partial support and are marked as such.`,
    open ? `${open} questions could not be closed from the documents; they are published with the dossier.` : 'No question of the dossier is still open.',
    'The desk publishes the sources, the claims and the open questions so that readers can check the work themselves.',
  ];
  draft.methodology = parts.join(' ');
  return draft;
}

function repairDraft(d, draft) {
  if (!draft || typeof draft !== 'object') return draft;
  const body = draft.article && typeof draft.article === 'object' ? draft.article : draft;
  if (!body.title || String(body.title).trim().length < 15) body.title = d.title;
  if (!body.dek || String(body.dek).trim().length < 10) body.dek = String(d.angle || d.title).slice(0, 220);
  if (!body.standfirst || String(body.standfirst).trim().length < 20) {
    body.standfirst = `What we could establish about ${d.title}, and what we could not.`;
  }
  // A plan that lists too few key facts is filled from the dossier, so the
  // piece keeps the figures the reader needs.
  if (!Array.isArray(body.facts) || body.facts.length < 4) {
    const onFile = (d.claims || [])
      .filter((c) => c.checked === 'supported')
      .slice(0, 8)
      .map((c) => String(c.text).slice(0, 300));
    body.facts = [...(Array.isArray(body.facts) ? body.facts : []), ...onFile].slice(0, 8);
  }
  // A model that lists every fact it knows writes hundreds of claims. The
  // article needs the load-bearing ones; the rest only make the JSON heavy
  // enough to cut the answer off.
  if (Array.isArray(body.claims)) {
    const ids = new Set((d.sources || []).map((x) => x.id));
    const seen = new Set();
    const kept = [];
    for (const c of body.claims) {
      const list = Array.isArray(c?.sources) ? c.sources.filter((id) => ids.has(id)) : [];
      if (!list.length) continue;
      const text = String(c.text || '').trim();
      if (!text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      kept.push({ ...c, sources: list });
      if (kept.length >= 30) break;
    }
    body.claims = kept;
  }

  // A cut-off answer leaves its last section half written. Fold such a
  // section into the one before it instead of throwing the piece away.
  if (Array.isArray(body.sections)) {
    const merged = [];
    for (const s of body.sections) {
      const paragraphs = Array.isArray(s?.paragraphs) ? s.paragraphs.filter((p) => String(p || '').trim()) : [];
      const heading = String(s?.heading || '').trim();
      if (paragraphs.length >= 2 || !merged.length) {
        merged.push({ ...s, heading: heading || `Section ${merged.length + 1}`, paragraphs });
      } else {
        const previous = merged[merged.length - 1];
        previous.paragraphs = [...previous.paragraphs, ...paragraphs];
      }
    }
    body.sections = merged.filter((s) => s.paragraphs.length >= 2);
  }
  return body;
}

/**
 * The plan before the text. The desk decides what the piece shows and in
 * which order, so that every section after it has one job and no repeats.
 */
async function planInvestigation(d, sectionCount) {
  const claims = d.claims
    .map((c) => `[${c.id}${c.status === 'contested' ? ' — CONTESTED' : ''}] ${String(c.text).slice(0, 320)} (sources: ${c.sources.join(', ')})`)
    .join('\n');
  const { data, model, text, doneReason } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You are the chief reporter of PLAIN., an independent Swiss news site. You plan investigative pieces from documents. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `INVESTIGATION: ${d.title}
QUESTION: ${d.angle}

VERIFIED CLAIMS (the piece must rest on these):
${claims}

GAPS WE COULD NOT CLOSE:
${d.gaps.slice(0, 15).map((g) => `- ${String(g).slice(0, 180)}`).join('\n') || '(none)'}

SOURCES:
${sourcePack(d, 12, 900)}

TASK: Plan the piece. Do not write the article yet.
- ${sectionCount} sections, each with a heading of max 60 characters and a one-line brief saying what the section shows.
- Section 1 opens with the single most concrete finding, not with background.
- One section must name the people this costs: the ones who lost money, work, land or freedom.
- The last section states what is still unknown and why that matters.
- facts: 5 to 8 key facts with numbers and dates.
- title: the finding. dek: one sentence, max 30 words, saying how solid the finding is.

Return exactly:
{"title":"…","dek":"one sentence, max 30 words","standfirst":"2-3 sentences that state what we found and how solid it is","facts":["5-8 key facts with numbers and dates"],"sections":[{"heading":"…","brief":"one line"}]}`,
    },
  ], { temperature: 0.3, maxTokens: 3000, numCtx: 65536, think: false, timeoutMs: 120000 });
  return { plan: data, model, text, doneReason };
}

/**
 * One section, one call. The section knows what the whole piece shows, so it
 * does not repeat the background the earlier sections already carry.
 */
async function writeSection(d, plan, planned, previous, paragraphCount) {
  const claims = d.claims
    .map((c) => `[${c.id}${c.status === 'contested' ? ' — CONTESTED' : ''}${c.checked === 'partial' ? ` — PARTIAL: ${c.checkNote || 'nur teilweise belegt'}` : ''}] ${String(c.text).slice(0, 420)} (sources: ${c.sources.join(', ')})`)
    .join('\n');
  const outline = (Array.isArray(plan.sections) ? plan.sections : [])
    .map((s, i) => `${i + 1}. ${String(s.heading || '').trim()}${s.brief ? ` — ${String(s.brief).trim()}` : ''}`)
    .join('\n');
  const done = previous.length
    ? previous.map((s, i) => `Section ${i + 1} "${s.heading}" is written.`).join('\n')
    : 'Nothing is written yet.';

  const { data, model, text, doneReason } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You are a senior investigative reporter at PLAIN., an independent Swiss news site. You write from documents, not from impressions. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `THE PIECE:
${plan.title}
${plan.dek || ''}

THE PLAN:
${outline}

WHAT IS ALREADY WRITTEN:
${done}

YOU WRITE NOW: SECTION ${previous.length + 1} - "${String(planned.heading || '').trim()}"
It must show: ${String(planned.brief || '').trim() || String(planned.heading || '').trim()}

VERIFIED CLAIMS (every fact must rest on one of them):
${claims}

RULES
- Write exactly ${paragraphCount} paragraphs of 110 to 150 words each. Nothing shorter, nothing longer.
- Open with the concrete fact of this section, not with background and not with a summary of the whole piece.
- Every factual sentence must rest on a claim above. If it is not in the claims, it is not in the text.
- Numbers, dates, names and titles exactly as in the sources. No rounding invented, no "about".
- This is a piece about people, not about process. Name who is affected and what it costs them.
- Contested claims: name who says what. Never present one side as established fact.
- No opinion, no prosecution rhetoric, no "shocking", no calls to resign. Show the facts; the reader draws the conclusion.
- Long, specific paragraphs. No bullet lists. No "in conclusion".
- Do not write four short declarative sentences in a row, and do not open consecutive sentences with the same subject. Each paragraph needs one longer sentence with two clauses.
- Depth comes from documents, figures and chronology, never from restating a finding in new words.
- No evaluative summary sentences ("This shows…", "The pattern underlines…"). End the paragraph on the last fact.
- Write nothing about a right of reply, a request date, a reply, a "no comment" or a confirmation that nobody gave us. The desk writes that itself.

Return exactly:
{"heading":"…","paragraphs":["…","…"]}`,
    },
  ], { temperature: 0.35, maxTokens: 2600, numCtx: 65536, think: false, timeoutMs: 150000 });
  const paragraphs = (Array.isArray(data?.paragraphs) ? data.paragraphs : [])
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  if (!paragraphs.length) throw new Error('the section came back empty');
  return {
    heading: String(data?.heading || planned.heading || '').trim() || `Section ${previous.length + 1}`,
    paragraphs,
  };
}

/**
 * The claims a piece rests on. They are filed in their own call, because a
 * model asked for body and claim list in one answer spends its budget on the
 * claim list and the last section of the article never arrives.
 */
async function fileClaims(d, body) {
  const sources = (d.sources || [])
    .map((s) => `${s.id}: ${String(s.title || '').slice(0, 100)} (${s.outlet || 'unknown outlet'})`)
    .join('\n');
  const headings = (body.sections || []).map((s) => s.heading).filter(Boolean).join(' | ');

  const claims = [];
  try {
    const { data } = await chatJSON('writer', [
      {
        role: 'system',
        content: `You are the fact checker of PLAIN. You file the claims an investigation rests on, each with the sources that carry it. Return JSON only.`,
      },
      {
        role: 'user',
        content: `The article below is about ${d.title}.
ITS HEADLINES: ${headings}

SOURCES (use these ids only):
${sources}

CLAIMS ON FILE IN THE DOSSIER (the article must rest on these):
${d.claims.map((c) => `[${c.id}] ${String(c.text).slice(0, 200)} (sources: ${c.sources.join(', ')})`).join('\n')}

TASK: List the claims the article cannot do without - the facts a reader must see to trust it.
- At most 20 claims. Fewer is better.
- One fact per claim, one short sentence each.
- Every claim needs the ids of the sources that carry it, taken from the list above.
- Only use facts that are on file in the dossier. Do not invent anything.

Return exactly:
${CLAIMS_SCHEMA}`,
      },
    ], { temperature: 0.1, maxTokens: 3000, numCtx: 32768, think: false, timeoutMs: 120000 });
    const ids = new Set((d.sources || []).map((x) => x.id));
    const seen = new Set();
    for (const c of (Array.isArray(data?.claims) ? data.claims : [])) {
      const src = (Array.isArray(c?.sources) ? c.sources : []).filter((id) => ids.has(id));
      const text = String(c?.text || '').trim();
      if (!src.length || !text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      claims.push({ text, sources: src });
      if (claims.length >= 20) break;
    }
  } catch (err) {
    log(`WRITE   claims not filed by the model (${err.message})`);
  }
  if (claims.length >= MIN_CLAIMS) return { claims };
  // The model filed too little. The dossier's own verified claims are on file
  // with their sources, so the piece still rests on something checked.
  return {
    claims: (d.claims || []).slice(0, 20).map((c) => ({ text: String(c.text).slice(0, 400), sources: c.sources })),
  };
}

async function writeInvestigation(d, outreach, { attempt = 1 } = {}) {
  // A model asked for a whole article at once writes a thousand words and
  // spends the rest of its budget on a claim list. The desk plans the piece
  // first and drafts it section by section: every call has one small job and
  // a length the writer can hit.
  const sectionCount = attempt === 1 ? 6 : 5;
  const paragraphCount = attempt === 1 ? 5 : 4;

  const planned = await planInvestigation(d, sectionCount);
  const plan = planned.plan || {};
  const planSections = (Array.isArray(plan.sections) ? plan.sections : [])
    .filter((s) => s && (s.heading || s.brief))
    .slice(0, sectionCount + 1);
  if (planSections.length < 5) throw new Error(`the plan has only ${planSections.length} sections`);

  const written = [];
  for (const plannedSection of planSections) {
    if (deadlineLeft() < 120000) {
      log(`WRITE   out of time after ${written.length} section(s)`);
      break;
    }
    try {
      written.push(await writeSection(d, plan, plannedSection, written, paragraphCount));
    } catch (err) {
      log(`WRITE   a section failed: ${err.message}`);
    }
  }

  const draft = {
    title: plan.title,
    dek: plan.dek,
    standfirst: plan.standfirst,
    facts: plan.facts,
    sections: written,
  };
  const filed = await fileClaims(d, draft);
  draft.claims = filed.claims;
  return {
    draft: applyMethodology(applyRightOfReply(repairDraft(d, draft), outreach), d),
    model: planned.model,
    text: planned.text,
    doneReason: planned.doneReason,
  };
}

/**
 * The piece came back complete but thin. A newsroom does not start over in
 * that case - it sends the draft back with the request to go deeper: more
 * chronology, more documents, more of the people it costs.
 */
async function expandInvestigation(d, draft, outreach) {
  const claims = d.claims
    .map((c) => `[${c.id}${c.status === 'contested' ? ' — CONTESTED' : ''}] ${String(c.text).slice(0, 420)} (sources: ${c.sources.join(', ')})`)
    .join('\n');
  const current = (draft.sections || [])
    .map((s) => `## ${s.heading}\n${(s.paragraphs || []).map((p) => p).join('\n\n')}`)
    .join('\n\n');

  const { data, model, text, doneReason } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You are a senior investigative reporter at PLAIN., an independent Swiss news site. You write from documents, not from impressions. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `INVESTIGATION: ${d.title}
QUESTION: ${d.angle}

VERIFIED CLAIMS (every factual sentence must rest on one of these):
${claims}

SOURCES:
${sourcePack(d, 8, 900)}

DRAFT SO FAR (${draftWords(draft)} words, too short):
${current}

TASK: Rewrite the piece so that it reaches at least ${MIN_WORDS} words. Keep the headline, the standfirst and the section headings. Keep every fact that is already there. Do not add a fact that is not in the claims above.

GO DEEPER, do not pad:
- Give every section at least 4 paragraphs of 110 to 160 words.
- Put the chronology in: which document, which date, which decision, in what order.
- Name the people it costs and what it costs them: the ones who lost money, work, land or freedom.
- Say what the institutions answered, and what they did not answer and when we asked.
- Say how we reported: which sources, which documents, what we could not verify.
- Do not return a claim list. The desk files the claims separately.

Return exactly:
${DRAFT_SCHEMA}`,
    },
  ], { temperature: 0.35, maxTokens: 14000, numCtx: 65536, think: false, timeoutMs: 180000 });
  const body = applyMethodology(applyRightOfReply(repairDraft(d, data), outreach), d);
  body.claims = (draft.claims || []).slice(0, 25);
  return { draft: body, model, text, doneReason };
}


/**
 * The draft reports answers that were never given. We have not sent a
 * single letter, so every reply, request date and "no comment" in it is
 * made up. Take them out and put the truth in their place.
 */
async function fixRightOfReply(d, draft, outreach) {
  const truth = rightOfReplyLog(outreach);

  const { data, model, text, doneReason } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You are a senior investigative reporter at PLAIN., an independent Swiss news site. You write from documents, not from impressions. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `The draft below reports answers that were never given. Our letters have not gone out, so every reply, every request date and every "no comment" in it is made up. A newsroom that invents a reply does not get to publish.

WHAT WE ACTUALLY DID:
${truth}

DRAFT TO CORRECT:
${JSON.stringify(draft)}

TASK: Return the corrected piece in the same shape.
- The desk writes the right of reply and the note on how we reported; you do not write either.
- Cut every sentence, in the sections too, that reports a reply, a request date, a confirmation or a "no comment".
- Say plainly, where it belongs, that our questions have not gone out yet.
- Keep every fact that rests on a source, keep the title, the standfirst, the headings and the length.
- Do not add any new fact.

Return exactly:
${DRAFT_SCHEMA}`,
    },
  ], { temperature: 0.3, maxTokens: 14000, numCtx: 65536, think: false, timeoutMs: 180000 });
  const body = applyMethodology(applyRightOfReply(repairDraft(d, data), outreach), d);
  body.claims = (draft.claims || []).slice(0, 25);
  return { draft: body, model, text, doneReason };
}

async function editInvestigation(d, outreach, draft, styleIssues = []) {
  const { data, model } = await chatJSON('editor', [
    {
      role: 'system',
      content: `You are the standards editor of PLAIN. You verify an investigation claim by claim against its sources. You cut anything that is not supported, and you are not impressed by rhetoric. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `SOURCES:\n${sourcePack(d, 20, 2500)}\n\nCLAIMS ON FILE:\n${d.claims.map((c) => `[${c.id}] ${c.text} — ${c.sources.join(', ')}`).join('\n')}\n\nRIGHT-OF-REPLY LOG:\n${rightOfReplyLog(outreach)}\n\nDRAFT:\n${JSON.stringify(draft)}
${styleIssues.length ? `\nSTYLE PROBLEMS MEASURED IN THE DRAFT (fix all of them):\n${styleIssues.map((p) => `- ${p}`).join('\n')}\n` : ''}
Check every sentence that carries a fact, a number, a date, a name or a quote.\n- Delete or correct anything not supported by the listed sources.\n- Keep the right of reply honest: an unanswered request is not a denial, and "no comment" must be reported as such with the date.\n- The right of reply and the note on how we reported are written by the desk; do not add them. But the body must not report a reply, a request date, a confirmation or a "no comment" that the RIGHT-OF-REPLY LOG does not hold. Cut those sentences.\n- Rewrite monotonous prose: vary sentence length, remove repeated sentence openings, cut evaluative summary sentences.\n- Do not add new facts and do not shorten the piece below ${Math.round(MIN_WORDS * 0.9)} words.\n\nVerdict: "publish" if every claim holds, "revise" with the corrected article in "article", "reject" if the evidence cannot carry the piece.\n\nReturn {"verdict":"publish|revise|reject","problems":["…"],"article":${DRAFT_SCHEMA}}`,
    },
  ], { temperature: 0.1, maxTokens: 16000 });
  return { review: data, model };
}

function draftWords(draft) {
  const body = (draft.sections || []).flatMap((s) => [s.heading || '', ...(s.paragraphs || [])]);
  return words([draft.standfirst, draft.dek, ...(draft.facts || []), ...body, draft.rightOfReply, draft.methodology].join(' '));
}


function draftProblem(d, draft, outreach = []) {
  if (!draft || typeof draft !== 'object') return 'no article';
  if (typeof draft.title !== 'string' || draft.title.trim().length < 15) return 'title';
  if (!draft.dek || !draft.standfirst) return 'dek/standfirst';
  if (!Array.isArray(draft.sections) || draft.sections.length < 5) return 'fewer than 5 sections';
  for (const s of draft.sections) {
    if (!s || !Array.isArray(s.paragraphs) || s.paragraphs.length < 2) return 'thin section';
  }
  if (!Array.isArray(draft.facts) || draft.facts.length < 4) return 'facts';
  if (!Array.isArray(draft.claims) || draft.claims.length < MIN_CLAIMS) return `claims (${draft.claims?.length || 0}/${MIN_CLAIMS})`;
  const ids = new Set(d.sources.map((s) => s.id));
  for (const c of draft.claims) {
    if (!Array.isArray(c.sources) || !c.sources.length || c.sources.some((id) => !ids.has(id))) return 'claim without valid source';
  }
  const asked = (outreach || []).filter((o) => ['sent', 'replied'].includes(o.status));
  if (!asked.length) {
    const replyText = [
      String(draft.rightOfReply || ''),
      String(draft.methodology || ''),
      ...(draft.sections || []).flatMap((s) => s.paragraphs || []),
    ].join('\n');
    const invented = replyText.match(INVENTED_REPLY);
    if (invented) return `right of reply invents an answer (${invented[0]})`;
  }
  if (draftWords(draft) < MIN_WORDS * 0.9) return `only ${draftWords(draft)} words`;
  const slop = slopHits({ title: draft.title, dek: draft.dek, facts: draft.facts, body: draft.sections.flatMap((s) => s.paragraphs), context: draft.rightOfReply });
  if (slop.length) return `banned phrases: ${slop.join(', ')}`;
  return null;
}

async function maybeWrite(d, outreach) {
  // A draft that did not pass the check is written again on the next shift.
  // Keeping it would mean the desk never gets to finish the piece.
  const rejected = d.review?.verdict === 'rejected';
  if (d.draft && !rejected) return;
  if (!isActive(d) || ['review', 'approved'].includes(d.status)) return;

  const outlets = distinctOutlets(d.sources).length;
  const primary = d.sources.filter((s) => s.primary).length;
  const sent = outreach.filter((o) => ['sent', 'replied'].includes(o.status));
  const replied = outreach.some((o) => o.status === 'replied');
  const oldest = sent.map((o) => o.sent_at).filter(Boolean).sort()[0];
  const replyReady = replied || (oldest && ageHours(oldest) >= REPLY_HOURS);

  const missing = [];
  if (outlets < MIN_SOURCES) missing.push(`${outlets}/${MIN_SOURCES} outlets`);
  if (primary < MIN_PRIMARY) missing.push(`${primary}/${MIN_PRIMARY} primary sources`);
  if (d.claims.length < MIN_CLAIMS) missing.push(`${d.claims.length}/${MIN_CLAIMS} claims`);
  if (!replyReady) {
    const replyUntil = oldest ? new Date(new Date(oldest).getTime() + REPLY_HOURS * 3600e3).toISOString().slice(0, 10) : null;
    missing.push(replyUntil ? `right of reply runs until ${replyUntil}` : 'no outreach sent');
  }

  // A draft that failed the check is rewritten even without the force flag:
  // the gates are about the material, and the material is already there.
  const forced = rejected || (FORCE_SLUG === d.slug && process.env.INVESTIGATE_FORCE_DRAFT === '1');
  if (missing.length && !forced) {
    d.nextStep = `keep reporting: ${missing.join(', ')}`;
    log(`WRITE   ${d.slug} not ready — ${missing.join(', ')}`);
    return;
  }
  if (forced) log(`WRITE   ${d.slug} forced past: ${missing.join(', ') || 'all gates met'}`);

  log(`WRITE   ${d.slug}: ${outlets} outlets, ${d.claims.length} claims, ${sent.length} request(s)`);
  let { draft, model, text, doneReason } = await writeInvestigation(d, outreach);
  let problem = draftProblem(d, draft, outreach);
  // Two chances, not one: a thin answer is sent back for depth, and if that
  // is still thin the whole piece is asked for again, shorter.
  for (let round = 1; problem && round <= 2 && deadlineLeft() > 300000; round += 1) {
    if (/^only \d+ words$/.test(problem) && round === 1) {
      // The piece holds but is thin. Ask for depth, not for a new piece.
      log(`WRITE   too short (${problem}) — asking for depth, not for a new piece`);
      ({ draft, model, text, doneReason } = await expandInvestigation(d, draft, outreach));
    } else if (/right of reply invents/.test(problem)) {
      // The piece claims answers we never got. Cut them out.
      log(`WRITE   ${problem} — asking for the truth instead`);
      ({ draft, model, text, doneReason } = await fixRightOfReply(d, draft, outreach));
    } else {
      // The answer was cut off or came back empty. Ask once more and ask for
      // less - a shorter piece that holds is worth more than no piece.
      log(`WRITE   answer unusable (${problem}) — asking again, shorter`);
      ({ draft, model, text, doneReason } = await writeInvestigation(d, outreach, { attempt: 2 }));
    }
    problem = draftProblem(d, draft, outreach);
  }
  if (problem) {
    log(`WRITE   draft rejected: ${problem} — model ${model || '?'}, stop reason ${doneReason || 'unknown'}, keys: ${Object.keys(draft || {}).join(', ') || 'none'}, answer ${text ? text.length : 0} characters`);
    // Throwing the text away would throw the shift's work away. The copy is
    // kept with the reason it failed; the dossier stays in research, so the
    // editor can read it and nobody can publish it.
    if (draft && typeof draft === 'object' && (draft.sections || []).length) {
      d.draft = draft;
      d.review = { verdict: 'rejected', problems: [problem], at: nowISO(), writer: model };
      d.nextStep = `draft needs work before it can be approved: ${problem}`;
      note(d, 'research', `draft did not pass the check: ${problem}`);
      log(`WRITE   draft kept for the editor, not publishable (${problem})`);
      return;
    }
    throw new Error(`draft rejected: ${problem}`);
  }

  const styleIssues = styleProblems(draft);
  if (styleIssues.length) log(`WRITE   style: ${styleIssues.join(' | ')}`);

  let editorModel = null;
  let verdict = 'skipped';
  try {
    const { review, model: em } = await editInvestigation(d, outreach, draft, styleIssues);
    editorModel = em;
    verdict = review?.verdict || 'unknown';
    log(`WRITE   editor ${verdict}${review?.problems?.length ? ` — ${review.problems.slice(0, 3).join(' | ')}` : ''}`);
    if (verdict === 'reject') {
      d.gaps = [...new Set([...d.gaps, ...(review.problems || [])])].slice(0, 12);
      d.nextStep = 'evidence did not carry the piece — keep reporting';
      note(d, 'research', 'editor rejected the draft');
      return;
    }
    if (verdict === 'revise' && review?.article) {
      // The editor corrects the text. The claims stay the ones the desk filed.
      const revised = { ...review.article, claims: (review.article.claims || draft.claims || []).slice(0, 25) };
      if (!draftProblem(d, revised, outreach)) {
        draft = applyMethodology(applyRightOfReply(revised, outreach), d);
      }
    }
  } catch (err) {
    log(`WRITE   editor failed (${err.message}); keeping writer draft`);
  }

  // The editor may have put an answer into the piece that nobody gave us.
  draft = applyMethodology(applyRightOfReply(draft, outreach), d);
  const after = draftProblem(d, draft, outreach);
  if (after) {
    log(`WRITE   editor output still wrong (${after}) — asking for the truth instead`);
    const { draft: fixed } = await fixRightOfReply(d, draft, outreach).catch(() => ({}));
    if (fixed && !draftProblem(d, fixed, outreach)) draft = fixed;
  }

  d.draft = draft;
  d.review = { verdict, problems: [], at: nowISO(), writer: model, editor: editorModel };
  d.nextStep = 'human approval in /admin/investigations';
  note(d, 'review', `draft ready: ${draftWords(draft)} words, ${draft.claims.length} claims`);
  log(`WRITE   ✓ draft ready (${draftWords(draft)} words)`);
}

// ─────────────────────────── 5. PUBLISH ───────────────────────────
// The dossier cites its claims and sources by number. A published article
// names the outlet instead: "according to source S11" becomes "according to
// TRM Labs", and the claim markers disappear.
function attribute(text, d) {
  const outlets = new Map(
    (d.sources || []).map((s) => [String(s.id).toUpperCase(), s.outlet || s.title || 'the source']),
  );
  const name = (id) => outlets.get(String(id).toUpperCase()) || 'the source';
  let out = String(text || '');
  out = out.replace(/\s*\((?:C\d+)(?:\s*,\s*C\d+)*\)/g, '');
  out = out.replace(/\b([Ss]ources?)\s+(S\d+(?:\s*(?:,|and|&)\s*S\d+)*)/g, (m, word, ids) => {
    const names = ids.split(/\s*(?:,|and|&)\s*/).map(name).filter((v, i, a) => a.indexOf(v) === i);
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  });
  out = out.replace(/\bS\d+\b/g, (id) => name(id));
  // A sentence that names the outlet itself does not need the attribution in
  // front of it: "According to the FBI, the FBI reports ..." says it twice.
  out = out.replace(/\b[Aa]ccording to\s+([^,]{2,60}?),\s*(.)/g, (match, names, first, offset, full) => {
    const last = names.split(/\s*(?:,|and|&)\s*/).pop() || '';
    const key = last.split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, '')).find((w) => w.length >= 3);
    if (!key) return match;
    const after = full.slice(offset + match.length, offset + match.length + 90).split('. ')[0];
    if (!new RegExp(`\\b${key}\\b`, 'i').test(after)) return match;
    return /[a-z]/.test(first) ? first.toUpperCase() : first;
  });
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * A heading cut in the middle of a word looks broken. Cut at the last word
 * that fits instead.
 */
function clipHeading(text, max = 90) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > 20 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, '');
}

function articleSections(draft, pictures = [], d = { sources: [] }) {
  const sections = assignImages(draft.sections.map((s) => ({
    heading: clipHeading(attribute(s.heading, d)),
    paragraphs: (s.paragraphs || []).map((p) => attribute(p, d)).filter(Boolean),
  })), pictures);
  if (draft.rightOfReply) {
    sections.push({ heading: 'Right of reply', paragraphs: String(draft.rightOfReply).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) });
  }
  if (draft.methodology) {
    sections.push({ heading: 'How we reported this', paragraphs: String(draft.methodology).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) });
  }
  return sections;
}

async function translateInvestigation(block, locale) {
  const lang = LOCALES.find((l) => l.code === locale);
  const { data } = await chatJSON('translator', [
    {
      role: 'system',
      content: `You are a professional investigative-news translator into ${lang.label} (${lang.bcp47}), in the neutral register of a quality newspaper. Keep structure, length and every fact exactly. Keep names, numbers, dates, document titles and quotes accurate, using the established local spelling. Never soften or sharpen a finding.${terminologyFor(locale)} Return JSON only with the same keys.`,
    },
    {
      role: 'user',
      content: `Translate into ${lang.label}. Keep the same number of sections and paragraphs. If a section has an "image" object, keep "url" and "credit" unchanged and translate only "caption".\n\n${JSON.stringify({ title: block.title, dek: block.dek, standfirst: block.standfirst, facts: block.facts, sections: block.sections, context: block.context, imageCaption: block.imageCaption || '' })}`,
    },
  ], { temperature: 0.2, maxTokens: 14000 });
  if (!Array.isArray(data.sections) || data.sections.length !== block.sections.length) throw new Error('translation lost sections');
  const sections = data.sections.map((s, i) => {
    const source = block.sections?.[i];
    const section = { heading: String(s.heading || ''), paragraphs: (s.paragraphs || []).map(String) };
    if (source?.image?.url) {
      section.image = {
        url: source.image.url,
        credit: source.image.credit || '',
        caption: String(s?.image?.caption || source.image.caption || '').trim(),
      };
    }
    return section;
  });

  return {
    title: String(data.title || block.title).trim(),
    dek: String(data.dek || block.dek).trim(),
    standfirst: String(data.standfirst || block.standfirst).trim(),
    facts: Array.isArray(data.facts) && data.facts.length === block.facts.length ? data.facts.map(String) : block.facts,
    body: sections.flatMap((s) => s.paragraphs),
    sections,
    context: String(data.context || block.context || '').trim(),
    imageCaption: String(data.imageCaption || block.imageCaption || '').trim(),
  };
}

async function publish(d) {
  if (!d.draft) throw new Error('no draft to publish');
  // A draft the desk itself rejected is not published, however it was
  // approved. The editor reads the text first; this only stops a broken one.
  if (d.review?.verdict === 'rejected') throw new Error('the draft did not pass the check');
  const draft = d.draft;
  const pictures = await collectImages(d.sources, {
    max: 3,
    terms: [draft.title, draft.dek, draft.standfirst].filter(Boolean),
  });
  const hero = pictures[0] || null;
  log(`PUBLISH  ${d.slug}: ${pictures.length} usable image(s)${hero ? ` — hero from ${hero.outlet || 'source'}` : ''}`);
  const sections = articleSections(draft, pictures, d);
  const body = sections.flatMap((s) => s.paragraphs);
  const wordCount = draftWords(draft);
  const usedIds = new Set((draft.claims || []).flatMap((c) => c.sources || []));
  const sources = d.sources
    .filter((s) => !usedIds.size || usedIds.has(s.id) || s.primary)
    .slice(0, 24)
    .map((s) => ({ outlet: s.outlet, title: s.title, url: s.url, publishedAt: s.publishedAt }));

  const doc = {
    slug: slugify(draft.title),
    category: d.category,
    form: 'investigation',
    image: hero?.url || null,
    imageCredit: hero?.credit || null,
    video: null,
    importance: 5,
    publishedAt: nowISO(),
    updatedAt: nowISO(),
    sourcePolicy: 'two-source',
    readingMinutes: Math.max(6, Math.round(wordCount / 215)),
    sources,
    locales: {
      [SOURCE_LOCALE]: {
        title: attribute(draft.title, d).trim(),
        dek: attribute(draft.dek, d).trim(),
        standfirst: attribute(draft.standfirst, d).trim(),
        facts: (draft.facts || []).map((f) => attribute(f, d)).slice(0, 8),
        body,
        sections,
        context: '',
        imageCaption: hero?.caption || '',
      },
    },
    history: [],
    meta: {
      desk: 'Investigativ',
      writer: d.review?.writer || null,
      editor: d.review?.editor || null,
      verdict: d.review?.verdict || null,
      words: wordCount,
      sources: sources.length,
      claims: draft.claims?.length || 0,
      investigation: d.slug,
      origin: d.origin,
    },
  };

  if (DRY_RUN) {
    log(`DRY     would publish "${doc.locales.en.title}" (${doc.readingMinutes} min, ${sources.length} sources)`);
    return;
  }

  saveArticle(doc);
  const index = loadIndex();
  if (!index.articles.some((a) => a.slug === doc.slug)) index.articles.unshift(toIndexEntry(doc));
  else index.articles = index.articles.map((a) => (a.slug === doc.slug ? toIndexEntry(doc) : a));
  saveIndex(index);

  const targets = TRANSLATE_LOCALES.filter((c) => c !== SOURCE_LOCALE);
  await pool(targets, TRANSLATE_CONCURRENCY, async (locale) => {
    try {
      const translated = await translateInvestigation(doc.locales[SOURCE_LOCALE], locale);
      doc.locales[locale] = translated;
      saveArticle(doc);
      index.articles = index.articles.map((a) => (a.slug === doc.slug ? toIndexEntry(doc) : a));
      return locale;
    } catch (err) {
      log(`PUBLISH  ${locale} translation failed: ${err.message}`);
      return null;
    }
  });
  saveIndex(index);

  const publishedAt = doc.publishedAt;
  d.published = { slug: doc.slug, at: publishedAt, translations: Object.keys(doc.locales).length };
  d.nextStep = 'published; monitor corrections and replies';
  note(d, 'published', `published as ${doc.slug} (${Object.keys(doc.locales).length} languages)`);
  await safe(() => setInvestigationStatus(d.slug, 'published', { published_at: publishedAt }));
  log(`PUBLISH ✓ ${doc.slug} — ${Object.keys(doc.locales).length} language(s)`);
}

// ─────────────────────────── mirror ───────────────────────────
// The editorial status lives in the database - that is where the editor
// changes it. The file holds the research. Without reading the decision
// back, an approval is seen as "review" on the next shift and then written
// over by the mirror: nobody could ever publish anything.
async function syncStatus(d) {
  const row = await getInvestigationStatus(d.slug).catch(() => null);
  if (!row?.status || row.status === d.status) return false;
  if (d.status === 'published') return false;
  d.status = row.status;
  if (row.approved_at) d.approvedAt = row.approved_at;
  note(d, null, `status from the editor's desk: ${row.status}`);
  log(`DESK  ${d.slug}: status ${row.status} (editor's desk)`);
  return true;
}

async function mirror(d) {
  if (DRY_RUN) return false;
  const rows = await outreachRows(d);
  const pending = rows.filter((r) => ['draft', 'approved', 'requested'].includes(r.status)).length;
  const sent = rows.filter((r) => ['sent', 'replied'].includes(r.status)).length;
  try {
    await upsertInvestigation({
      slug: d.slug,
      title: d.title,
      angle: d.angle,
      category: d.category,
      status: d.status,
      priority: d.priority ?? 2,
      origin: d.origin || 'desk',
      request_id: d.requestId || null,
      source_count: d.sources.length,
      verified_claims: d.claims.length,
      open_questions: (d.gaps || []).length,
      outreach_pending: pending,
      outreach_sent: sent,
      next_step: d.nextStep || null,
      published_at: d.published?.at || null,
    });
    return true;
  } catch (err) {
    log(`  ! ${err.message}`);
    return false;
  }
}

// ─────────────────────────── main ───────────────────────────
async function main() {
  const started = Date.now();
  // Last resort: a stalled request must never hold the job for its full timeout.
  const budgetMin = Number(process.env.INVESTIGATE_MINUTES || 55);
  setTimeout(() => {
    log(`WATCHDOG  ${budgetMin + 3} min reached — stopping without saving`);
    process.exit(0);
  }, (budgetMin + 3) * 60_000).unref();
  const indexAvailable = (() => { try { loadIndex(); return true; } catch (e) { log(`FATAL ${e.message}`); return false; } })();
  if (!indexAvailable) process.exit(1);

  fs.mkdirSync(DOSSIER_DIR, { recursive: true });
  const dossiers = loadDossiers();
  const state = loadState();

  // A retired dossier leaves the active set but stays in the admin desk; the
  // status is mirrored once so the UI does not keep it on the working list.
  for (const d of dossiers.filter((x) => x.status === 'archived' && x.mirroredStatus !== 'archived')) {
    if (DRY_RUN) break;
    // Only a dossier that really reached the database counts as mirrored.
    if (!(await mirror(d))) continue;
    d.mirroredStatus = 'archived';
    saveDossier(d);
  }

  // Diagnostic mode: only the agent, nothing else, so a test run ends fast.
  if (process.env.INVESTIGATE_ONLY === 'doors') {
    // Only the walk to the institutions: it shows whether the desk can still
    // reach the documents, without a model and without touching the mail.
    const only = FORCE_SLUG ? dossiers.filter((d) => d.slug === FORCE_SLUG) : dossiers.filter(isActive).slice(0, 1);
    for (const d of only) {
      log(`\n▶ ${d.slug} [${d.status}] — doors only`);
      pruneOffTopic(d);
      const added = await openPrimaryDoors(d).catch((err) => { log(`DOORS  failed: ${err.message}`); return 0; });
      log(`DOORS  ${added} document(s) filed`);
      for (const s of d.sources) log(`   [${s.id}] ${s.primary ? 'P' : ' '} ${s.outlet} — ${s.title.slice(0, 80)}\n       ${s.url}`);
      saveDossier(d);
    }
    log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.`);
    return;
  }

  if (process.env.INVESTIGATE_ONLY === 'agent') {
    // A forced intake still has to run first — with no active dossier there is
    // nothing for the agent to work on.
    if (!dossiers.some(isActive)) await intake(dossiers, state);
    const only = FORCE_SLUG ? dossiers.filter((d) => d.slug === FORCE_SLUG) : dossiers.filter(isActive).slice(0, 1);
    for (const d of only) {
      log(`\n▶ ${d.slug} [${d.status}] — agent only`);
      const ok = await researchAgent(d).catch((err) => { log(`AGENT  failed: ${err.message}`); return false; });
      log(`AGENT  ${ok ? 'added' : 'added nothing'} — ${d.sources.length} source(s), ${d.claims.length} claim(s), ${d.contacts.length} contact(s)`);
      saveDossier(d);
    }
    log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.`);
    return;
  }

  // A run that only carries an editor's decision does not open a new dossier
  // and does not hunt for new topics: it does what the editor asked.
  const decisionSlug = parseLetterDecision(APPROVE_LETTERS)?.slug || parseLetterDecision(REJECT_LETTERS)?.slug || '';
  if (!decisionSlug) {
    // The desk reads the cabinets before it opens anything: a story of its own
    // begins with a document, not with a tip.
    await scanForLeads(state, dossiers).catch((err) => log(`SCAN  failed: ${err.message}`));
    await intake(dossiers, state);
  }

  // The desk reads its own mailbox first: an answer that arrived overnight
  // changes what the shift should look at.
  const filed = await pollMailbox(dossiers, state);
  if (filed) log(`INBOX  ${filed} message(s) filed`);
  saveState(state);

  const focus = FORCE_SLUG || decisionSlug;
  const targets = focus ? dossiers.filter((d) => d.slug === focus) : dossiers.filter(isActive);
  log(`DESK  ${targets.length} dossier(s) to advance`);

  for (const d of targets) {
    if (deadlineLeft() < 90000) {
      log(`DESK  deadline close — stopping before ${d.slug}`);
      break;
    }
    try {
      log(`\n▶ ${d.slug} [${d.status}]`);
      // The editor decides in the database. Read that decision before doing
      // anything else with the dossier.
      await syncStatus(d).catch((err) => log(`STATUS  unreachable: ${err.message}`));
      // The editor's approval comes in with the run. It is written into the
      // dossier, so the next shift reads the same decision, and into the
      // database if that one is reachable.
      if (APPROVE_SLUG && APPROVE_SLUG === d.slug && d.status !== 'published') {
        const at = nowISO();
        d.status = 'approved';
        d.approvedAt = at;
        d.approvedBy = APPROVED_BY;
        d.nextStep = 'approved by the editor; publishing';
        note(d, null, `approved by ${APPROVED_BY}`);
        await safe(() => setInvestigationStatus(d.slug, 'approved', { approved_at: at }));
        log(`DESK  ${d.slug}: approved by ${APPROVED_BY}`);
      }
      if (!isActive(d)) {
        log(`  ${d.status} - the editor closed this one; leaving it alone`);
        await mirror(d);
        continue;
      }
      // The editor frees a letter with the run. The letter goes out in this
      // shift, whatever else the dossier is still short of. Before that, the
      // desk takes back the letters the story does not call for: a letter to
      // an organisation it has no question about must not reach the editor's
      // desk, and must not go out if it is already there.
      await pruneContacts(d).catch((err) => log(`OUTREACH  recipients not checked: ${err.message}`));
      await applyLetterDecision(d);
      await sendApproved(d).catch((err) => log(`OUTREACH  sending failed: ${err.message}`));
      if (d.status === 'approved') {
        await publish(d);
        if (d.status === 'published') rememberFollowups(state, d);
      } else if (d.status === 'review') {
        log('  waiting for human approval');
        d.nextStep = 'human approval in /admin/investigations';
      } else {
        // Mail first: a reply from an authority is evidence, and it can change
        // what the agent should look for next.
        await readInbox(d).catch((err) => log(`INBOX  unreachable: ${err.message}`));
        // Who must answer is found before the model spends the shift. The
        // institutions the last shift filed are known; their addresses are
        // what lets a letter leave the building, and the hunt is slow enough
        // to be worth starting early.
        await fillContactAddresses(d).catch((err) => log(`RESEARCH  addresses not found: ${err.message}`));
        if (['pitch', 'research'].includes(d.status) || d.sources.length < MIN_SOURCES || d.claims.length < MIN_CLAIMS) {
          await research(d);
        }
        log(`CHECK   ${d.claims.length} claim(s), ${d.sources.length} source(s) before reading back`);
        await factcheck(d);
        // Who must answer is found on the institutions' own pages, not spent
        // as a step of the model.
        await fileContacts(d).catch((err) => log(`OUTREACH  press addresses not found: ${err.message}`));
        // A dead database must not take the shift with it. The requests are
        // prepared for the editor either way; the draft is the work product
        // and it does not need a single row in a table.
        await queueReminders(d).catch((err) => log(`OUTREACH  reminder failed: ${err.message}`));
        await queueOutreach(d).catch((err) => log(`OUTREACH  queue failed: ${err.message}`));
        await draftOutreach(d).catch((err) => log(`OUTREACH  drafting failed: ${err.message}`));
        const fresh = await outreachRows(d).catch(() => []);
        await maybeWrite(d, fresh);
      }
      await mirror(d);
    } catch (err) {
      log(`✗ ${d.slug}: ${err.message}`);
    } finally {
      saveDossier(d);
    }
  }

  state.runs = [{ at: nowISO(), active: targets.length, ms: Date.now() - started }, ...(state.runs || [])].slice(0, 100);
  saveState(state);
  saveDossierIndex(dossiers);
  log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.`);
}

// Keep-alive sockets from fetch, rss-parser and pdf.js hold the event loop
// open long after the work is done — a finished run once sat 20 minutes in CI
// on that alone. Everything is on disk by now, so the process can go.
function finish(code = 0) {
  process.stdout.write('', () => process.exit(code));
}

main().then(() => finish(0)).catch((err) => {
  console.error(err);
  finish(1);
});
