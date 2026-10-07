import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function testComposite() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 850, deviceScaleFactor: 2 });
  await page.goto('https://www.plain-news.ch/de', { waitUntil: 'networkidle2' });
  const screenBuffer = await page.screenshot({ type: 'png' });
  await browser.close();

  const resizedScreen = await sharp(screenBuffer)
    .resize(860, 1420, { fit: 'cover' })
    .toBuffer();

  const mask = Buffer.from(
    '<svg width="860" height="1420"><rect x="0" y="0" width="860" height="1420" rx="36" ry="36" fill="#fff"/></svg>'
  );
  const roundedScreen = await sharp(resizedScreen)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const baseSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <rect width="1080" height="1920" fill="#F4F1EA"/>
      <line x1="80" y1="100" x2="1000" y2="100" stroke="#111111" stroke-width="2"/>
      <text x="80" y="75" font-family="'Courier New', monospace" font-size="20" font-weight="700" letter-spacing="3" fill="#111111">PLAIN. WALKTHROUGH</text>
      <text x="1000" y="75" text-anchor="end" font-family="'Courier New', monospace" font-size="20" font-weight="700" letter-spacing="2" fill="#776f5f">01 / 05</text>
      
      <text x="80" y="155" font-family="Georgia, serif" font-size="44" font-weight="900" fill="#111111">01. Lärmfreier Newsfeed</text>
      <text x="1000" y="155" text-anchor="end" font-family="'Courier New', monospace" font-size="20" font-weight="700" fill="#776f5f">0 WERBUNG</text>

      <rect x="106" y="216" width="868" height="1428" rx="40" ry="40" fill="none" stroke="#111111" stroke-width="4"/>
      
      <line x1="80" y1="1720" x2="1000" y2="1720" stroke="#111111" stroke-width="2"/>
      <text x="80" y="1775" font-family="'Courier New', monospace" font-size="22" font-weight="700" fill="#111111" letter-spacing="2">NEWS WITHOUT NOISE</text>
      <text x="1000" y="1775" text-anchor="end" font-family="Georgia, serif" font-size="34" font-weight="900" fill="#111111">plain-news.ch</text>
      <text x="80" y="1825" font-family="'Courier New', monospace" font-size="18" fill="#776f5f">Kostenlos im Browser • Keine Paywall • 2-Quellen-Regel</text>
    </svg>
  `);

  const outPath = 'C:\\Users\\Simon\\.gemini\\antigravity\\brain\\2ca82bd4-4e93-4750-a352-322d18846780\\test_composite_mockup.png';
  await sharp(baseSvg)
    .composite([
      { input: roundedScreen, left: 110, top: 220 }
    ])
    .png()
    .toFile(outPath);

  console.log('Composite mockup created at:', outPath);
}

testComposite().catch(console.error);
