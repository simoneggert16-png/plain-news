import { execSync } from 'child_process';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

console.log('PLAIN Continuous Newsroom Daemon started. Running every 15 minutes...');

async function runCycle() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting newsroom ingest cycle...`);
  try {
    execSync('node bots/newsroom.mjs', { stdio: 'inherit', env: process.env });
    console.log(`[${timestamp}] Newsroom cycle complete. Committing changes...`);
    execSync('git add content/ && git commit -m "newsroom: auto-publish" && git push origin main', { stdio: 'inherit' });
    console.log(`[${timestamp}] Successfully pushed fresh stories to production!`);
  } catch (err) {
    console.error(`[${timestamp}] Error during cycle:`, err.message);
  }
}

async function loop() {
  await runCycle();
  setInterval(runCycle, INTERVAL_MS);
}

loop();
