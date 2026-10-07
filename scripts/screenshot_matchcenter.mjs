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
    await el.screenshot({ path: 'C:/Users/Simon/.gemini/antigravity/brain/2ca82bd4-4e93-4750-a352-322d18846780/match_center_facts_proof.png' });
    console.log('Facts-only MatchCenter screenshot captured!');

    const toggleBtns = await page.$$('.lineup-toggle-btn');
    if (toggleBtns[1]) {
      await toggleBtns[1].click();
      await new Promise(r => setTimeout(r, 800));
      await el.screenshot({ path: 'C:/Users/Simon/.gemini/antigravity/brain/2ca82bd4-4e93-4750-a352-322d18846780/match_center_list_no_emojis.png' });
      console.log('Facts-only List screenshot captured!');
    }
  }

  await browser.close();
}

capture();
