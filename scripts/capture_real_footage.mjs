import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(process.cwd(), 'public', 'footage');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Mobile Portrait (iPhone 16 Pro: 430 x 932, scale 2)
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  console.log('Navigating to http://127.0.0.1:3000/de ...');
  await page.goto('http://127.0.0.1:3000/de', { waitUntil: 'networkidle0', timeout: 25000 });
  await page.screenshot({ path: path.join(OUT_DIR, 'mobile_frontpage_top.png') });
  console.log('Saved mobile_frontpage_top.png');

  // Smooth scroll down to capture breaking section
  await page.evaluate(() => window.scrollBy(0, 750));
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, 'mobile_frontpage_scroll.png') });
  console.log('Saved mobile_frontpage_scroll.png');

  // 2. Full Article View & Match Center
  try {
    console.log('Navigating to Messi article...');
    await page.goto('http://127.0.0.1:3000/de/a/lionel-messi-bestreitet-letztes-laenderspiel-fuer-argentinien-abschied-im-monumental-20261006-m10', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUT_DIR, 'mobile_article_headline.png') });
    console.log('Saved mobile_article_headline.png');

    const mc = await page.$('.match-center-card');
    if (mc) {
      await mc.scrollIntoView();
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(OUT_DIR, 'mobile_matchcenter.png') });
      console.log('Saved mobile_matchcenter.png');
    }
  } catch (e) {
    console.warn('Article capture warning:', e.message);
  }

  // 3. Desktop Masthead and Big Grid (1280 x 850, scale 2)
  try {
    console.log('Capturing desktop broadsheet...');
    await page.setViewport({ width: 1280, height: 850, deviceScaleFactor: 2 });
    await page.goto('http://127.0.0.1:3000/de', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT_DIR, 'desktop_frontpage_broadsheet.png') });
    console.log('Saved desktop_frontpage_broadsheet.png');
  } catch (e) {
    console.warn('Desktop capture warning:', e.message);
  }

  // 4. Capture a continuous mobile scroll sequence of frontpage!
  console.log('Capturing scroll sequence for live browser interaction...');
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/de', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  
  const scrollFramesDir = path.join(OUT_DIR, 'scroll_seq');
  if (!fs.existsSync(scrollFramesDir)) fs.mkdirSync(scrollFramesDir, { recursive: true });

  const totalScroll = 1200;
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const scrollY = Math.round((i / steps) * totalScroll);
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.screenshot({ path: path.join(scrollFramesDir, `scroll_${String(i).padStart(3, '0')}.png`) });
  }
  console.log('Saved scroll sequence frames!');

  await browser.close();
  console.log('Done capturing all authentic website footage!');
}

run().catch(err => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
