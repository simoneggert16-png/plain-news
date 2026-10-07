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

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
process.env.MAX_STORIES_PER_RUN = process.env.MAX_STORIES_PER_RUN || '2';
process.env.MAX_PER_CATEGORY = process.env.MAX_PER_CATEGORY || '1';

console.log('====================================================');
console.log('PLAIN Continuous Newsroom Daemon (2 stories / 15 min)');
console.log('====================================================');

async function runCycle() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Starting newsroom ingest cycle (Target: 2 fresh stories)...`);
  try {
    // 1. Run newsroom bot with 15-minute timeout safeguard (translating 2 stories to 9 langs takes ~5-7 min)
    execSync('node bots/newsroom.mjs', {
      stdio: 'inherit',
      env: process.env,
      timeout: 15 * 60 * 1000,
    });

    // 2. Check if new stories were published in content/
    const changed = execSync('git status --porcelain content/', { encoding: 'utf8' }).trim();
    if (changed) {
      console.log(`[${new Date().toISOString()}] Fresh articles detected in content/. Committing and pushing to origin main...`);
      execSync('git add content/ && git commit -m "newsroom: auto-publish 2 fresh stories" && git push origin main', {
        stdio: 'inherit',
        timeout: 60 * 1000,
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
  console.log(`\n[${new Date().toISOString()}] Cycle finished. Next automated run scheduled for ${nextDate.toLocaleTimeString()} (in 15 min)...`);
  setTimeout(loop, INTERVAL_MS);
}

loop();
