import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(process.cwd(), 'public', 'footage_en');

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

  // 1. Mobile Tall Viewport for Buttery-Smooth CSS Scroll (iPhone 16 Pro: 430 x 1800, scale 2)
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  console.log('Navigating to http://127.0.0.1:3000/en ...');
  await page.goto('http://127.0.0.1:3000/en', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  
  // Capture full tall page screenshot (single image we can translate smoothly without stepping!)
  await page.screenshot({ path: path.join(OUT_DIR, 'mobile_frontpage_tall.png'), fullPage: false });
  console.log('Saved mobile_frontpage_tall.png');

  // Capture taller viewport of frontpage (height 2600)
  await page.setViewport({ width: 430, height: 2600, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/en', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, 'mobile_frontpage_long.png') });
  console.log('Saved mobile_frontpage_long.png (height 2600px for continuous 60fps translate)');

  // 2. Principles / About page (English)
  console.log('Navigating to http://127.0.0.1:3000/en/about ...');
  await page.setViewport({ width: 430, height: 1200, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/en/about', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, 'mobile_principles.png') });
  console.log('Saved mobile_principles.png');

  // 3. Desktop English Broadsheet (1366 x 850 @2x)
  console.log('Capturing Desktop English Broadsheet...');
  await page.setViewport({ width: 1366, height: 850, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/en', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, 'desktop_broadsheet_en.png') });
  console.log('Saved desktop_broadsheet_en.png');

  // 4. Article with Framing Comparison (English)
  // Let's find an article to show "How outlets headlined it" / Framing!
  const articleLinks = await page.$$eval('a[href*="/en/a/"]', els => els.map(e => e.href));
  if (articleLinks.length > 0) {
    console.log('Navigating to article for framing inspection:', articleLinks[0]);
    await page.setViewport({ width: 430, height: 1400, deviceScaleFactor: 2 });
    await page.goto(articleLinks[0], { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUT_DIR, 'mobile_article_en.png') });
    console.log('Saved mobile_article_en.png');

    // Scroll to framing if exists
    const framing = await page.$('.framing, .sources, .key-facts');
    if (framing) {
      await framing.scrollIntoView();
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: path.join(OUT_DIR, 'mobile_article_framing.png') });
      console.log('Saved mobile_article_framing.png');
    }
  }

  await browser.close();
  console.log('All English authentic footage captured successfully!');
}

run().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
