import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OUTPUT_DIR = path.join(process.cwd(), 'social_content');
const FRAMES_DIR = path.join(OUTPUT_DIR, 'frames');
if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });

// Clean speech text with phonetic optimization for German TTS
const VOICE_TEXT = "Kein Klickbejt. Keine Meinungsmache. Francis Halzen gewinnt den Nobelpreis für Physik 2026 für seine Arbeit am Ice-Cube Neutrino Observatorium am Südpol. Tausende Lichtsensoren im ewigen Eis spüren hochenergetische Geisterteilchen aus fernen Galaxien auf. Alle Primärquellen ohne Werbung auf plain news Punkt c h.";

// Step 1: Generate clean Voice WAV
const psCode = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice("Microsoft Hedda Desktop")
$speaker.Rate = 0
$outFile = "${path.join(OUTPUT_DIR, 'nobel_voice.wav').replace(/\\/g, '\\\\')}"
$speaker.SetOutputToWaveFile($outFile)
$speaker.Speak("${VOICE_TEXT}")
$speaker.Dispose()
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'gen_voice.ps1'), psCode, 'utf8');
execSync(`powershell -ExecutionPolicy Bypass -File "${path.join(OUTPUT_DIR, 'gen_voice.ps1')}"`, { stdio: 'inherit' });

// Helper to wrap text cleanly by words
function wrapWords(str, maxChars) {
  const words = str.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Step 2: Generate 3 Key Story Frames (SVG -> PNG)
const frames = [
  {
    tag: 'NOBELPREIS PHYSIK 2026',
    titleLines: ['Francis Halzen gewinnt', 'Nobelpreis für Physik'],
    bodyLines: [
      'Auszeichnung für das IceCube',
      'Neutrino-Observatorium am Südpol.',
      'Detektion hochenergetischer Teilchen.'
    ],
    stat: '1 KM³ EISARRAY • 5.160 SENSOREN',
  },
  {
    tag: 'DIE ENTDECKUNG',
    titleLines: ['Kosmische „Geisterteilchen“', 'aus fernen Galaxien'],
    bodyLines: [
      'Billionen Neutrinos durchdringen die Erde.',
      'IceCube fängt die seltenen',
      'kosmischen Hochenergie-Treffer ein.'
    ],
    stat: '12 MIO. SCHWEDISCHE KRONEN PREISGELD',
  },
  {
    tag: 'PLAIN. — NACHRICHTEN OHNE LÄRM',
    titleLines: ['0 Werbung. 0 Tracking.', '100% Fakten.'],
    bodyLines: [
      'Jeder Artikel basiert auf mindestens',
      'zwei unabhängigen Primärquellen.',
      'Keine Meinungsmache. Reine Fakten.'
    ],
    stat: 'JETZT ONLINE: plain-news.ch',
  }
];

function buildFrameSVG(f) {
  const titleSvg = f.titleLines.map((line, idx) => `
    <text x="80" y="${430 + idx * 75}" font-family="'Times New Roman', Georgia, serif" font-size="62" font-weight="bold" fill="#111111">${line}</text>
  `).join('');

  const bodySvg = f.bodyLines.map((line, idx) => `
    <text x="120" y="${750 + idx * 60}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="500" fill="#111111">${line}</text>
  `).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
    <rect width="1080" height="1920" fill="#EAE3D2"/>
    
    <!-- Outer Newspaper Border -->
    <rect x="40" y="40" width="1000" height="1840" fill="none" stroke="#111111" stroke-width="4"/>
    <rect x="52" y="52" width="976" height="1816" fill="none" stroke="#111111" stroke-width="1.5"/>

    <!-- Header Masthead -->
    <text x="100" y="160" font-family="'Times New Roman', Georgia, serif" font-size="64" font-weight="900" letter-spacing="4" fill="#111111">PLAIN<tspan fill="#776f5f">.</tspan></text>
    <text x="980" y="160" text-anchor="end" font-family="Courier, monospace" font-size="24" font-weight="700" fill="#444444">EDITION 07.10.2026</text>
    <line x1="80" y1="200" x2="1000" y2="200" stroke="#111111" stroke-width="3"/>

    <!-- Tag Pill -->
    <rect x="80" y="260" width="${f.tag.length * 20 + 36}" height="52" fill="#111111"/>
    <text x="98" y="296" font-family="Courier, monospace" font-size="24" font-weight="700" fill="#EAE3D2" letter-spacing="2">${f.tag}</text>

    <!-- Main Big Headline (Clean wrapped) -->
    ${titleSvg}

    <line x1="80" y1="590" x2="1000" y2="590" stroke="#111111" stroke-width="2"/>

    <!-- Summary Box -->
    <rect x="80" y="660" width="920" height="380" fill="#DFD7C2" stroke="#111111" stroke-width="2"/>
    ${bodySvg}

    <!-- Stat Ribbon -->
    <rect x="80" y="1120" width="920" height="100" fill="#111111"/>
    <text x="540" y="1185" text-anchor="middle" font-family="Courier, monospace" font-size="28" font-weight="700" fill="#EAE3D2" letter-spacing="2">${f.stat}</text>

    <!-- Visual Soundwave Indicator -->
    <g transform="translate(100, 1380)">
      <rect x="0" y="20" width="8" height="60" fill="#111111"/>
      <rect x="24" y="0" width="8" height="100" fill="#111111"/>
      <rect x="48" y="30" width="8" height="40" fill="#111111"/>
      <rect x="72" y="10" width="8" height="80" fill="#111111"/>
      <rect x="96" y="25" width="8" height="50" fill="#111111"/>
      <text x="130" y="65" font-family="Courier, monospace" font-size="28" font-weight="700" fill="#111111">VOICEOVER: VERIFIZIERTE PRIMÄRQUELLEN</text>
    </g>

    <!-- Footer URL -->
    <line x1="80" y1="1720" x2="1000" y2="1720" stroke="#111111" stroke-width="3"/>
    <text x="540" y="1790" text-anchor="middle" font-family="Courier, monospace" font-size="34" font-weight="900" fill="#111111" letter-spacing="4">WWW.PLAIN-NEWS.CH</text>
  </svg>`;
}

import sharp from 'sharp';

// Render SVG to crisp PNGs (1080x1920)
for (let i = 0; i < frames.length; i++) {
  const svgPath = path.join(FRAMES_DIR, `frame_${i + 1}.svg`);
  const pngPath = path.join(FRAMES_DIR, `frame_${i + 1}.png`);
  fs.writeFileSync(svgPath, buildFrameSVG(frames[i]), 'utf8');
  await sharp(Buffer.from(buildFrameSVG(frames[i]))).png().toFile(pngPath);
  console.log(`Rendered frame ${i + 1} PNG (1080x1920)`);
}

console.log('Frames converted to PNG! Now compiling MP4 video using FFmpeg...');

// Step 3: Compile MP4 with FFmpeg
const ffmpegPath = 'C:\\Users\\Simon\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe';

const p1 = path.join(FRAMES_DIR, 'frame_1.png');
const p2 = path.join(FRAMES_DIR, 'frame_2.png');
const p3 = path.join(FRAMES_DIR, 'frame_3.png');
const audio = path.join(OUTPUT_DIR, 'nobel_voice.wav');
const finalMp4 = path.join(OUTPUT_DIR, 'plain_nobel_clip.mp4');

// Create concat script with perfect pacing
const concatTxt = path.join(OUTPUT_DIR, 'concat.txt');
fs.writeFileSync(concatTxt, `
file '${p1.replace(/\\/g, '/')}'
duration 6.5
file '${p2.replace(/\\/g, '/')}'
duration 7.0
file '${p3.replace(/\\/g, '/')}'
duration 8.0
file '${p3.replace(/\\/g, '/')}'
`, 'utf8');

const cmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${concatTxt}" -i "${audio}" -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -shortest "${finalMp4}"`;
console.log('Running FFmpeg video render...');
execSync(cmd, { stdio: 'inherit' });

console.log('DONE! Animated TikTok / Reel clip rendered at:', finalMp4);
