import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1300 });

  await page.goto('http://127.0.0.1:3000/de/a/lionel-messi-bestreitet-letztes-laenderspiel-fuer-argentinien-abschied-im-monumental-20261006-m10', { waitUntil: 'networkidle0', timeout: 20000 });
  await page.waitForSelector('.match-center-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));

  const el = await page.$('.match-center-card');
  if (el) {
    await el.scrollIntoView();
    // 1. Screenshot of the dynamic vector pitch
    await el.screenshot({ path: 'C:/Users/Simon/.gemini/antigravity/brain/2ca82bd4-4e93-4750-a352-322d18846780/sofascore_dynamic_svg_pitch.png' });
    console.log('Dynamic SVG pitch screenshot captured!');

    // 2. Click on a player node on the SVG pitch to show the interactive drawer!
    const playerNode = await page.$('.pitch-player-node:nth-child(11)'); // e.g. Messi or De Paul
    if (playerNode) {
      await playerNode.click();
      await new Promise(r => setTimeout(r, 600));
      await el.screenshot({ path: 'C:/Users/Simon/.gemini/antigravity/brain/2ca82bd4-4e93-4750-a352-322d18846780/sofascore_dynamic_interactive_drawer.png' });
      console.log('Interactive player drawer screenshot captured!');
    }
  }

  await browser.close();
}

capture();
