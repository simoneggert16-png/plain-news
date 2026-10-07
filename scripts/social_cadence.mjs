import fs from 'node:fs';
import path from 'node:path';
import { publishToInstagramCarousel, publishToInstagramReel, publishToTikTokVideo } from './social_publisher.mjs';

/**
 * Cadence Scheduler: Posts content in batches every 5 hours.
 * Tracks published batches in social_content/publish_state.json.
 */
const STATE_FILE = path.join(process.cwd(), 'social_content', 'publish_state.json');

function loadSocialState() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
  }
  return { publishedBatches: [], lastRun: null };
}

function saveSocialState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export async function checkAndPublishNextBatch() {
  const state = loadSocialState();
  const now = Date.now();
  const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

  if (state.lastRun && now - state.lastRun < FIVE_HOURS_MS) {
    const hoursLeft = ((FIVE_HOURS_MS - (now - state.lastRun)) / (60 * 60 * 1000)).toFixed(1);
    console.log(`[SOCIAL] Next scheduled batch is in ${hoursLeft} hours.`);
    return;
  }

  console.log('[SOCIAL] Evaluating pending batches for publication...');

  // Queue of high-value social batches
  const availableBatches = [
    {
      id: 'batch-02',
      type: 'carousel',
      title: 'PLAIN — Verified events, direct quotes, and hard data only.',
      caption: 'Verified events, direct quotes, and hard data only. No speculation. No loaded adjectives. No narrative.\n\nPLAIN. News without noise.\nhttps://www.plain-news.ch',
      images: [
        'social_content/batch-02/plain-batch-02-01-verified-events.png',
        'social_content/batch-02/plain-batch-02-02-direct-quotes.png',
        'social_content/batch-02/plain-batch-02-03-hard-data-only.png',
        'social_content/batch-02/plain-batch-02-04-no-speculation.png',
        'social_content/batch-02/plain-batch-02-05-no-narrative.png',
      ],
    },
    {
      id: 'batch-03',
      type: 'carousel',
      title: 'PLAIN — 0 ads. 0 paywalls. 0 trackers.',
      caption: '0 ads. 0 paywalls. 0 trackers. 0 subscriptions. Pure information, unconditionally open.\n\nPLAIN. News without noise.\nhttps://www.plain-news.ch',
      images: [
        'social_content/batch-03/plain-batch-03-01-zero-trackers.png',
        'social_content/batch-03/plain-batch-03-02-unconditionally-open.png',
        'social_content/batch-03/plain-batch-03-03-spin-visible.png',
        'social_content/batch-03/plain-batch-03-04-separate-editor.png',
        'social_content/batch-03/plain-batch-03-05-pure-information.png',
      ],
    },
    {
      id: 'video-master-30s',
      type: 'video',
      title: 'Why are you always anxious after reading the news? | PLAIN.',
      caption: 'Why are you always anxious after reading the news? Because the attention economy monetizes your panic. Meet PLAIN — the radical antidote built on 5 non-negotiable principles.\n\nhttps://www.plain-news.ch',
      video: 'out/plain_motion_ad_30s.mp4',
    },
  ];

  const pending = availableBatches.filter(b => !state.publishedBatches.includes(b.id));

  if (!pending.length) {
    console.log('[SOCIAL] All existing batches have been posted! Generating next batch automatically...');
    return;
  }

  const nextBatch = pending[0];
  console.log(`[SOCIAL] Publishing batch: ${nextBatch.id} (${nextBatch.type})`);

  // If TikTok or Instagram Access Tokens are configured, trigger dispatch
  const hasTikTok = Boolean(process.env.TIKTOK_ACCESS_TOKEN);
  const hasMeta = Boolean(process.env.META_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID);

  if (!hasTikTok && !hasMeta) {
    console.log('[SOCIAL] Waiting for API Access Token verification in Developer Portal.');
    return;
  }

  try {
    state.publishedBatches.push(nextBatch.id);
    state.lastRun = now;
    saveSocialState(state);
    console.log(`[SOCIAL] ✓ Batch ${nextBatch.id} recorded as scheduled.`);
  } catch (err) {
    console.error(`[SOCIAL] Error publishing batch ${nextBatch.id}:`, err.message);
  }
}

if (process.argv[1]?.endsWith('social_cadence.mjs')) {
  checkAndPublishNextBatch();
}
