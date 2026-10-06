import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const OUTPUT_DIR = path.join(process.cwd(), 'social_content');
const TOUR_FRAMES_DIR = path.join(OUTPUT_DIR, 'tour_frames');
if (!fs.existsSync(TOUR_FRAMES_DIR)) fs.mkdirSync(TOUR_FRAMES_DIR, { recursive: true });

const FPS = 24;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG_PATH = 'C:\\Users\\Simon\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe';

const MASK_SVG = Buffer.from(
  '<svg width="880" height="1440"><rect x="0" y="0" width="880" height="1440" rx="36" ry="36" fill="#fff"/></svg>'
);

function makeOverlaySvg(stepNum, stepTotal, headline, tag, ctaHighlight) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <rect width="1080" height="1920" fill="#F4F1EA"/>
      
      <!-- Top Swiss Wire Header -->
      <line x1="80" y1="100" x2="1000" y2="100" stroke="#111111" stroke-width="2"/>
      <text x="80" y="75" font-family="'Courier New', monospace" font-size="20" font-weight="700" letter-spacing="3" fill="#111111">PLAIN. TOUR</text>
      <text x="1000" y="75" text-anchor="end" font-family="'Courier New', monospace" font-size="20" font-weight="700" letter-spacing="2" fill="#776f5f">${stepNum} / ${stepTotal}</text>
      
      <!-- Section Title -->
      <text x="80" y="160" font-family="Georgia, serif" font-size="44" font-weight="900" fill="#111111">${headline}</text>
      <text x="1000" y="160" text-anchor="end" font-family="'Courier New', monospace" font-size="20" font-weight="700" fill="#776f5f">${tag}</text>

      <!-- Phone Outer Frame / Bezel -->
      <rect x="96" y="216" width="888" height="1448" rx="40" ry="40" fill="none" stroke="#111111" stroke-width="4"/>
      
      <!-- Bottom Footer -->
      <line x1="80" y1="1710" x2="1000" y2="1710" stroke="#111111" stroke-width="2"/>
      <text x="80" y="1765" font-family="'Courier New', monospace" font-size="22" font-weight="700" fill="#111111" letter-spacing="2">NEWS WITHOUT NOISE</text>
      <text x="1000" y="1765" text-anchor="end" font-family="Georgia, serif" font-size="34" font-weight="900" fill="#111111">plain-news.ch</text>
      <text x="80" y="1815" font-family="'Courier New', monospace" font-size="18" fill="#776f5f">${ctaHighlight}</text>
    </svg>
  `);
}

function makeOutroSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <rect width="1080" height="1920" fill="#F4F1EA"/>
      
      <line x1="80" y1="120" x2="1000" y2="120" stroke="#111111" stroke-width="2.5"/>
      <text x="80" y="95" font-family="'Courier New', monospace" font-size="20" font-weight="700" letter-spacing="3" fill="#111111">PLAIN. EDITORIAL</text>
      <text x="1000" y="95" text-anchor="end" font-family="'Courier New', monospace" font-size="20" font-weight="700" letter-spacing="2" fill="#776f5f">06 / 06</text>

      <g transform="translate(80, 480)">
        <text x="460" y="0" text-anchor="middle" font-family="Georgia, serif" font-size="120" font-weight="900" letter-spacing="4" fill="#111111">PLAIN<tspan fill="#776f5f">.</tspan></text>
        <line x1="180" y1="45" x2="740" y2="45" stroke="#111111" stroke-width="2"/>
        <text x="460" y="100" text-anchor="middle" font-family="'Courier New', monospace" font-size="24" font-weight="700" letter-spacing="3" fill="#776f5f">NEWS WITHOUT NOISE</text>
      </g>

      <g transform="translate(80, 780)">
        <rect width="920" height="400" fill="#111111"/>
        <text x="460" y="110" text-anchor="middle" font-family="Georgia, serif" font-size="52" font-weight="bold" fill="#F4F1EA">
          Kostenlos für immer.
        </text>
        <line x1="120" y1="160" x2="800" y2="160" stroke="#776f5f" stroke-width="1.5"/>

        <text x="460" y="240" text-anchor="middle" font-family="'Courier New', monospace" font-size="24" fill="#C5BCA8">
          0 WERBUNG • 0 TRACKING • 0 PAYWALL
        </text>
        <text x="460" y="300" text-anchor="middle" font-family="'Courier New', monospace" font-size="24" fill="#C5BCA8">
          2-QUELLEN-PRÜFUNG • 9 SPRACHEN • LIVE MÄRKTE
        </text>
      </g>

      <g transform="translate(80, 1300)">
        <rect width="920" height="190" fill="#EAE5DA" stroke="#111111" stroke-width="3"/>
        <text x="460" y="80" text-anchor="middle" font-family="'Courier New', monospace" font-size="26" font-weight="700" fill="#111111" letter-spacing="3">DIREKT IM BROWSER ÖFFNEN:</text>
        <text x="460" y="145" text-anchor="middle" font-family="Georgia, serif" font-size="54" font-weight="900" fill="#111111" letter-spacing="4">plain-news.ch</text>
      </g>

      <line x1="80" y1="1760" x2="1000" y2="1760" stroke="#111111" stroke-width="1.5"/>
      <text x="80" y="1815" font-family="'Courier New', monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">LINK IN DER BIO</text>
      <text x="1000" y="1815" text-anchor="end" font-family="'Courier New', monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">plain-news.ch</text>
    </svg>
  `);
}

async function renderPlatformTour() {
  console.log('Starting Real Footage Tour Recording for PLAIN (plain-news.ch)...');
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // Viewport at 440 x 720 with scale 2 gives exactly 880 x 1440
  await page.setViewport({ width: 440, height: 720, deviceScaleFactor: 2 });

  let currentFrame = 0;

  async function captureScene(url, framesCount, startScroll, endScroll, stepNum, stepTotal, headline, tag, ctaHighlight) {
    console.log(`Recording Scene ${stepNum}: ${headline} (${framesCount} frames)...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Slight pause to ensure CSS and fonts are completely painted
    await new Promise(r => setTimeout(r, 600));

    const overlaySvg = makeOverlaySvg(stepNum, stepTotal, headline, tag, ctaHighlight);

    for (let f = 0; f < framesCount; f++) {
      const progress = f / (framesCount - 1);
      // smooth ease-in-out scroll
      const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      const scrollY = Math.round(startScroll + (endScroll - startScroll) * ease);

      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      
      const screenBuf = await page.screenshot({ type: 'png' });
      
      // Mask rounded corners
      const roundedScreen = await sharp(screenBuf)
        .composite([{ input: MASK_SVG, blend: 'dest-in' }])
        .png()
        .toBuffer();

      // Composite onto 1080x1920 base
      const frameFile = path.join(TOUR_FRAMES_DIR, `f_${String(currentFrame).padStart(5, '0')}.png`);
      await sharp(overlaySvg)
        .composite([
          { input: roundedScreen, left: 100, top: 220 }
        ])
        .png({ compressionLevel: 4 })
        .toFile(frameFile);

      currentFrame++;
      if (currentFrame % 30 === 0) {
        console.log(`Rendered frame ${currentFrame}...`);
      }
    }
  }

  // ── SCENE 1: Homepage Feed (4.5s = 108 frames)
  await captureScene(
    'https://www.plain-news.ch/de',
    108,
    0,
    550,
    '01',
    '05',
    '01. Lärmfreier Newsfeed',
    '0 WERBUNG • 0 TRACKING',
    'Kostenlos im Browser • Keine Banner • Reine Fakten'
  );

  // ── SCENE 2: Article & 2-Quellen-Regel (5.5s = 132 frames)
  await captureScene(
    'https://www.plain-news.ch/de/a/uk-oil-refinery-broke-pollution-permit-conditions-58-times-20261006-x7pr',
    132,
    150,
    950,
    '02',
    '05',
    '02. Zwei-Quellen-Regel',
    'FRAMING-VERGLEICH',
    'Mindestens 2 unabhängige Quellen • Offene Zitate'
  );

  // ── SCENE 3: Live Märkte & Börsencharts (4.5s = 108 frames)
  await captureScene(
    'https://www.plain-news.ch/de/markets',
    108,
    0,
    420,
    '03',
    '05',
    '03. Live Finanzmärkte',
    'ECHTZEIT-CHARTS',
    'S&amp;P 500 • DAX • SMI • Bitcoin • Gold ohne Spam'
  );

  // ── SCENE 4: 9 Sprachen Umschalter (4.0s = 96 frames)
  await captureScene(
    'https://www.plain-news.ch/en',
    96,
    0,
    300,
    '04',
    '05',
    '04. In 9 Sprachen',
    'GLOBAL INFORMATIV',
    'DE • EN • FR • IT • ES • PT • JA • ZH • RU'
  );

  // ── SCENE 5: Community & Kommentare (4.5s = 108 frames)
  await captureScene(
    'https://www.plain-news.ch/de/c/community',
    108,
    0,
    420,
    '05',
    '05',
    '05. Community &amp; Notizen',
    'OFFENE EINREICHUNGEN',
    'Artikel vorschlagen • Sachliche Kommentare'
  );

  await browser.close();

  // ── SCENE 6: Outro Monolith (3.5s = 84 frames)
  console.log('Rendering Scene 6: Outro Monolith (84 frames)...');
  const outroSvg = makeOutroSvg();
  const outroPng = await sharp(outroSvg).png().toBuffer();
  for (let f = 0; f < 84; f++) {
    const frameFile = path.join(TOUR_FRAMES_DIR, `f_${String(currentFrame).padStart(5, '0')}.png`);
    fs.writeFileSync(frameFile, outroPng);
    currentFrame++;
  }

  console.log(`All ${currentFrame} frames rendered! Compiling final MP4 with FFmpeg...`);

  // Ambient bed audio
  const audioFile = path.join(OUTPUT_DIR, 'ambient_tape_bed.m4a');
  const finalMp4 = path.join(OUTPUT_DIR, 'plain_real_footage_tour.mp4');

  const ffmpegCmd = `"${FFMPEG_PATH}" -y -framerate ${FPS} -i "${path.join(TOUR_FRAMES_DIR, 'f_%05d.png')}" -i "${audioFile}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 18 -c:a aac -b:a 128k -shortest "${finalMp4}"`;
  execSync(ffmpegCmd, { stdio: 'inherit' });

  console.log('REAL FOOTAGE TOUR VIDEO RENDERED SUCCESSFULLY:', finalMp4);
}

renderPlatformTour().catch(console.error);
