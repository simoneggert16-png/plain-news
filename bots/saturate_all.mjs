import { spawn } from 'child_process';
import fs from 'fs';
import { CATEGORIES } from '../lib/config.mjs';

function getCounts() {
  const d = JSON.parse(fs.readFileSync('content/index.json', 'utf8'));
  const counts = {};
  for (const c of CATEGORIES) counts[c] = 0;
  for (const a of d.articles) counts[a.category] = (counts[a.category] || 0) + 1;
  return { counts, total: d.articles.length };
}

async function runNewsroomBatch(maxStories = 10, maxPerCat = 3) {
  return new Promise((resolve) => {
    const child = spawn('node', ['bots/newsroom.mjs'], {
      env: {
        ...process.env,
        MAX_STORIES_PER_RUN: String(maxStories),
        MAX_PER_CATEGORY: String(maxPerCat),
        TARGET_PER_CATEGORY: '25',
      },
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      resolve(code);
    });
  });
}

async function loop() {
  console.log('=== STARTING AUTOMATED NEWSROOM SATURATION (TARGET: 25 PER CATEGORY) ===');
  let iteration = 1;
  while (iteration <= 15) {
    const { counts, total } = getCounts();
    console.log(`\n================== BATCH ${iteration} ==================`);
    console.log(`Total Published Stories: ${total}`);
    console.log('Category Counts:', Object.entries(counts).map(([k, v]) => `${k}:${v}/25`).join(' | '));
    
    const allDone = CATEGORIES.every((c) => counts[c] >= 25);
    if (allDone) {
      console.log('All categories reached 25+ stories! Goal achieved.');
      break;
    }

    const code = await runNewsroomBatch(12, 4);
    console.log(`Batch ${iteration} exited with code ${code}`);

    // Auto-commit and push newly published stories
    try {
      const { execSync } = await import('child_process');
      execSync('git add content/', { stdio: 'inherit' });
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim().length > 0) {
        execSync(`git commit -m "feat(newsroom): auto-publish batch ${iteration}"`, { stdio: 'inherit' });
        execSync('git push origin main', { stdio: 'inherit' });
        console.log(`Git push for batch ${iteration} successful!`);
      } else {
        console.log('No new files to commit in this batch.');
      }
    } catch (gitErr) {
      console.warn('Git sync warning:', gitErr.message);
    }

    iteration++;
    // Small pause between batches
    await new Promise((r) => setTimeout(r, 3000));
  }
  
  const finalStatus = getCounts();
  console.log('\n=== SATURATION RUN FINISHED ===');
  console.log('Final counts:', finalStatus.counts);
}

loop().catch(console.error);
