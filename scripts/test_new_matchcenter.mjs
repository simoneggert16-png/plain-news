import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testScreenshots() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1200 });

  await page.goto('http://127.0.0.1:3000/de/ticker', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  // Expand
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.textContent.includes('SPIELDETAILS'));
    if (target) target.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Click Aufstellung & Formation tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.match-tab-btn'));
    const target = btns.find(b => b.textContent.includes('Aufstellung'));
    if (target) target.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  const el = await page.$('.match-center-card');
  if (el) {
    await el.screenshot({ path: 'C:/Users/Simon/.gemini/antigravity/brain/2ca82bd4-4e93-4750-a352-322d18846780/lineups_default_list_proof.png' });
    console.log('Lineups default list screenshot captured!');
  }

  await browser.close();
}

testScreenshots();
