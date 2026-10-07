import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://127.0.0.1:3000/de/a/lionel-messi-bestreitet-letztes-laenderspiel-fuer-argentinien-abschied-im-monumental-20261006-m10', { waitUntil: 'networkidle0', timeout: 20000 });
  await page.waitForSelector('.match-center-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));

  const el = await page.$('.match-center-card');
  if (el) {
    await el.scrollIntoView();
    await el.screenshot({ path: 'C:/Users/Simon/.gemini/antigravity/brain/2ca82bd4-4e93-4750-a352-322d18846780/sofascore_tactical_pitch_proof.png' });
    console.log('MatchCenter card screenshot captured!');
  }

  // Also test clicking the detailed list view
  const listBtn = await page.$('.lineup-toggle-btn:nth-child(2)');
  if (listBtn) {
    await listBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const listEl = await page.$('.match-center-card');
    if (listEl) {
      await listEl.screenshot({ path: 'C:/Users/Simon/.gemini/antigravity/brain/2ca82bd4-4e93-4750-a352-322d18846780/sofascore_list_proof.png' });
      console.log('List view screenshot captured!');
    }
  }

  await browser.close();
}

capture();
