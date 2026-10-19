import { execSync } from 'child_process';
import fs from 'node:fs';

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const INTERVAL_MS = 60 * 60 * 1000; // every hour
process.env.MAX_STORIES_PER_RUN = process.env.MAX_STORIES_PER_RUN || '0';
process.env.MAX_PER_CATEGORY = process.env.MAX_PER_CATEGORY || '0';
process.env.MIN_PER_CATEGORY_PER_CYCLE = process.env.MIN_PER_CATEGORY_PER_CYCLE || '1';
process.env.TARGET_PER_CATEGORY_PER_CYCLE = process.env.TARGET_PER_CATEGORY_PER_CYCLE || '0';
process.env.EVENT_CONCURRENCY = process.env.EVENT_CONCURRENCY || '3';
process.env.RECENT_WINDOW_HOURS = process.env.RECENT_WINDOW_HOURS || '1';
process.env.MAX_ARTICLES_PER_DAY = process.env.MAX_ARTICLES_PER_DAY || '0';

console.log('====================================================');
console.log('PLAIN Newsroom Daemon (9 desks, every hour)');
console.log('Target: at least 1 and up to 2 verified stories per category per cycle');
console.log('====================================================');

async function runCycle() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Starting newsroom cycle (Target: 1-2 fresh stories per category)...`);
  try {
    // 1. Run newsroom bot
    execSync('node bots/newsroom.mjs', {
      stdio: 'inherit',
      env: process.env,
      timeout: 120 * 60 * 1000,
    });

    // 2. Run social media cadence check (5-hour batch window)
    try {
      execSync('node scripts/social_cadence.mjs', {
        stdio: 'inherit',
        env: process.env,
        timeout: 60 * 1000,
      });
    } catch (socErr) {
      console.warn(`[${new Date().toISOString()}] Social cadence notice:`, socErr.message);
    }

    // 3. Check if new stories were published in content/
    const changed = execSync('git status --porcelain content/ social_content/', { encoding: 'utf8' }).trim();
    if (changed) {
      console.log(`[${new Date().toISOString()}] Fresh articles/social assets detected. Committing and pushing to origin main...`);
      execSync('git add content/ social_content/ && git commit -m "newsroom: publish fresh category stories and social cadence" && git push origin main', {
        stdio: 'inherit',
        timeout: 90 * 1000,
      });
      console.log(`[${new Date().toISOString()}] ✓ Successfully pushed fresh stories to production!`);
    } else {
      console.log(`[${new Date().toISOString()}] No new articles generated in this cycle.`);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error during newsroom cycle:`, err.message);
  }
}

async function loop() {
  await runCycle();
  const nextDate = new Date(Date.now() + INTERVAL_MS);
  console.log(`\n[${new Date().toISOString()}] Cycle finished. Next automated run scheduled for ${nextDate.toLocaleString()} (in 1 hour)...`);
  setTimeout(loop, INTERVAL_MS);
}

loop();
