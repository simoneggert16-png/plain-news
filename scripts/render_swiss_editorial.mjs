import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';

// High-End Swiss Modernism 9:16 Video Engine for PLAIN. (plain-news.ch)
const OUTPUT_DIR = path.join(process.cwd(), 'social_content');
const EDITORIAL_FRAMES_DIR = path.join(OUTPUT_DIR, 'swiss_editorial_frames');
if (!fs.existsSync(EDITORIAL_FRAMES_DIR)) fs.mkdirSync(EDITORIAL_FRAMES_DIR, { recursive: true });

const audioFile = path.join(OUTPUT_DIR, 'editorial_baritone.mp3');
const ffprobe = 'C:\\Users\\Simon\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffprobe.exe';
const durationStr = execSync(`"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`, { encoding: 'utf8' }).trim();
const totalDuration = parseFloat(durationStr) || 28.2;
const FPS = 24;
const totalFrames = Math.round(totalDuration * FPS);

console.log(`Rendering Swiss Modernism Editorial Video (${totalFrames} frames @ 24fps, Duration: ${totalDuration.toFixed(2)}s)...`);

// Scenes based on Brand Guidelines:
// Scene 1 (0 to 6.5s): Hook: "Nachrichten heute sind kaputt." + "Clickbait, Werbebanner, Paywalls..."
// Scene 2 (6.5s to 13.0s): Core Solution: "Wir haben plain gebaut." + "0 Werbung, 0 Tracking, 0 Meinungsmache."
// Scene 3 (13.0s to 19.5s): The Mechanism: "Die 2-Quellen-Pflicht." + "Vergleiche die Original-Schlagzeilen."
// Scene 4 (19.5s to end): Closing: "plain-news.ch · News without noise." + "Kostenlos für immer."

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

for (let frame = 0; frame < totalFrames; frame++) {
  const time = frame / FPS;
  let svg = '';

  if (time < 6.5) {
    // ── SCENE 1: THE DISRUPTION ──
    const tNorm = clamp(time / 6.5, 0, 1);
    const lineReveal = clamp((time - 0.5) / 1.2, 0, 1);
    const factReveal = clamp((time - 2.8) / 1.2, 0, 1);

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <!-- High-End Swiss Warm Off-White / Beige #F4F1EA -->
      <rect width="1080" height="1920" fill="#F4F1EA"/>
      
      <!-- Subtle Archival Grain Filter Simulation -->
      <line x1="80" y1="120" x2="1000" y2="120" stroke="#111111" stroke-width="2.5"/>
      <text x="80" y="95" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" letter-spacing="3" fill="#111111">PLAIN. EDITORIAL WIRE</text>
      <text x="1000" y="95" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" letter-spacing="2" fill="#776f5f">01 / 04</text>

      <!-- Hook Overlay (Max 5 words, high-end serif) -->
      <g transform="translate(80, 460)">
        <text x="0" y="0" font-family="Georgia, 'Times New Roman', serif" font-size="76" font-weight="900" line-height="1.1" fill="#111111">
          Nachrichten heute
        </text>
        <text x="0" y="90" font-family="Georgia, 'Times New Roman', serif" font-size="76" font-weight="900" fill="#111111">
          sind kaputt.
        </text>
        <rect x="0" y="140" width="${840 * lineReveal}" height="3" fill="#111111"/>
      </g>

      <!-- Core Context Box (Swiss Grid Style) -->
      <g transform="translate(80, 840)" opacity="${factReveal}">
        <rect width="920" height="420" fill="#EAE5DA" stroke="#111111" stroke-width="1.5"/>
        <text x="60" y="90" font-family="'Courier New', Courier, monospace" font-size="22" font-weight="700" letter-spacing="2" fill="#776f5f">BEFUND</text>
        <line x1="60" y1="120" x2="860" y2="120" stroke="#111111" stroke-width="1"/>

        <text x="60" y="190" font-family="Georgia, serif" font-size="34" font-weight="400" fill="#111111">
          Clickbait, überladene Werbebanner,
        </text>
        <text x="60" y="245" font-family="Georgia, serif" font-size="34" font-weight="400" fill="#111111">
          endlose Paywalls und Meinungsmache
        </text>
        <text x="60" y="300" font-family="Georgia, serif" font-size="34" font-weight="400" fill="#111111">
          verdrängen reine Tatsachen.
        </text>
      </g>

      <!-- Bottom Audio / Brand Anchor -->
      <line x1="80" y1="1760" x2="1000" y2="1760" stroke="#111111" stroke-width="1.5"/>
      <text x="80" y="1815" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">NEWS WITHOUT NOISE</text>
      <text x="1000" y="1815" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">plain-news.ch</text>
    </svg>`;

  } else if (time < 13.0) {
    // ── SCENE 2: THE COUNTER-PROPOSITION (SWISS MODERNISM) ──
    const sceneProg = clamp((time - 6.5) / 6.5, 0, 1);
    const lineReveal = clamp((time - 7.0) / 1.0, 0, 1);
    const cardReveal = clamp((time - 8.5) / 1.0, 0, 1);

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <rect width="1080" height="1920" fill="#F4F1EA"/>
      
      <line x1="80" y1="120" x2="1000" y2="120" stroke="#111111" stroke-width="2.5"/>
      <text x="80" y="95" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" letter-spacing="3" fill="#111111">MANIFEST</text>
      <text x="1000" y="95" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" letter-spacing="2" fill="#776f5f">02 / 04</text>

      <!-- Giant Monolith Brand Name -->
      <g transform="translate(80, 420)">
        <text x="0" y="0" font-family="Georgia, 'Times New Roman', serif" font-size="110" font-weight="900" letter-spacing="2" fill="#111111">PLAIN<tspan fill="#776f5f">.</tspan></text>
        <line x1="0" y1="40" x2="${920 * lineReveal}" y2="40" stroke="#111111" stroke-width="4"/>
        <text x="0" y="90" font-family="'Courier New', Courier, monospace" font-size="26" font-weight="700" letter-spacing="1" fill="#776f5f">NACHRICHTEN OHNE LÄRM</text>
      </g>

      <!-- Three Core Pillars (Grid) -->
      <g transform="translate(80, 680)" opacity="${cardReveal}">
        <rect width="920" height="140" fill="#111111"/>
        <text x="60" y="85" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#F4F1EA">01. Null Werbung</text>
        <text x="860" y="85" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="22" font-weight="700" fill="#C5BCA8">KEINE BANNER</text>
      </g>

      <g transform="translate(80, 850)" opacity="${cardReveal}">
        <rect width="920" height="140" fill="#111111"/>
        <text x="60" y="85" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#F4F1EA">02. Null Tracking</text>
        <text x="860" y="85" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="22" font-weight="700" fill="#C5BCA8">KEINE PROFILE</text>
      </g>

      <g transform="translate(80, 1020)" opacity="${cardReveal}">
        <rect width="920" height="140" fill="#111111"/>
        <text x="60" y="85" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#F4F1EA">03. Null Meinungsmache</text>
        <text x="860" y="85" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="22" font-weight="700" fill="#C5BCA8">REINE FAKTEN</text>
      </g>

      <line x1="80" y1="1760" x2="1000" y2="1760" stroke="#111111" stroke-width="1.5"/>
      <text x="80" y="1815" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">SWISS EDITORIAL STANDARD</text>
      <text x="1000" y="1815" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">plain-news.ch</text>
    </svg>`;

  } else if (time < 19.5) {
    // ── SCENE 3: THE VERIFICATION SYSTEM ──
    const sceneProg = clamp((time - 13.0) / 6.5, 0, 1);
    const reveal = clamp((time - 13.5) / 1.0, 0, 1);

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <rect width="1080" height="1920" fill="#F4F1EA"/>
      
      <line x1="80" y1="120" x2="1000" y2="120" stroke="#111111" stroke-width="2.5"/>
      <text x="80" y="95" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" letter-spacing="3" fill="#111111">PRÜFPROTOKOLL</text>
      <text x="1000" y="95" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" letter-spacing="2" fill="#776f5f">03 / 04</text>

      <g transform="translate(80, 380)">
        <text x="0" y="0" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="bold" fill="#111111">
          Die Zwei-Quellen-Regel.
        </text>
        <line x1="0" y1="35" x2="920" y2="35" stroke="#111111" stroke-width="2"/>
        <text x="0" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" fill="#444444">
          Kein Gerücht wird publiziert. Mindestens zwei unabhängige
        </text>
        <text x="0" y="125" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" fill="#444444">
          Weltagenturen müssen denselben Vorgang bestätigen.
        </text>
      </g>

      <!-- Framing Box -->
      <g transform="translate(80, 720)" opacity="${reveal}">
        <rect width="920" height="520" fill="#EAE5DA" stroke="#111111" stroke-width="2"/>
        <text x="60" y="70" font-family="'Courier New', Courier, monospace" font-size="22" font-weight="700" letter-spacing="2" fill="#776f5f">FRAMING-VERGLEICH BEI JEDEM ARTIKEL</text>
        <line x1="60" y1="100" x2="860" y2="100" stroke="#111111" stroke-width="1"/>

        <!-- Competing Headlines comparison -->
        <g transform="translate(60, 130)">
          <rect width="800" height="90" fill="#ffffff" stroke="#111111" stroke-width="1"/>
          <text x="25" y="40" font-family="'Courier New', monospace" font-size="16" fill="#776f5f">REUTERS</text>
          <text x="25" y="68" font-family="Georgia, serif" font-size="22" font-weight="bold" fill="#111111">„Ölpreise stabilisieren sich nach Treffen.“</text>
        </g>

        <g transform="translate(60, 240)">
          <rect width="800" height="90" fill="#ffffff" stroke="#111111" stroke-width="1"/>
          <text x="25" y="40" font-family="'Courier New', monospace" font-size="16" fill="#776f5f">BÖRSEN-MAGAZIN</text>
          <text x="25" y="68" font-family="Georgia, serif" font-size="22" font-weight="bold" fill="#111111">„Märkte zittern vor neuem Preisschock!“</text>
        </g>

        <!-- Verdict extracted by PLAIN -->
        <g transform="translate(60, 360)">
          <rect width="800" height="110" fill="#111111"/>
          <text x="25" y="45" font-family="'Courier New', monospace" font-size="18" font-weight="700" fill="#C5BCA8">PLAIN. EXTRAKT</text>
          <text x="25" y="80" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#ffffff">Faktenstand: OPEC belässt Fördermengen unverändert.</text>
        </g>
      </g>

      <line x1="80" y1="1760" x2="1000" y2="1760" stroke="#111111" stroke-width="1.5"/>
      <text x="80" y="1815" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">VERIFIKATION VOR PUBLIKATION</text>
      <text x="1000" y="1815" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">plain-news.ch</text>
    </svg>`;

  } else {
    // ── SCENE 4: CLOSING & IMMERSIVE ENGAGEMENT ──
    const sceneProg = clamp((time - 19.5) / (totalDuration - 19.5), 0, 1);
    const boxReveal = clamp((time - 20.0) / 1.0, 0, 1);

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <rect width="1080" height="1920" fill="#F4F1EA"/>
      
      <line x1="80" y1="120" x2="1000" y2="120" stroke="#111111" stroke-width="2.5"/>
      <text x="80" y="95" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" letter-spacing="3" fill="#111111">ZUGANG</text>
      <text x="1000" y="95" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" letter-spacing="2" fill="#776f5f">04 / 04</text>

      <g transform="translate(80, 400)">
        <text x="460" y="0" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="100" font-weight="900" letter-spacing="4" fill="#111111">PLAIN<tspan fill="#776f5f">.</tspan></text>
        <line x1="160" y1="40" x2="760" y2="40" stroke="#111111" stroke-width="2"/>
        <text x="460" y="90" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-size="24" font-weight="700" letter-spacing="2" fill="#776f5f">NEWS WITHOUT NOISE</text>
      </g>

      <g transform="translate(80, 680)" opacity="${boxReveal}">
        <rect width="920" height="420" fill="#111111"/>
        <text x="460" y="110" text-anchor="middle" font-family="Georgia, serif" font-size="52" font-weight="bold" fill="#F4F1EA">
          Kostenlos für immer.
        </text>
        <line x1="100" y1="160" x2="820" y2="160" stroke="#776f5f" stroke-width="1.5"/>

        <text x="460" y="240" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-size="24" fill="#C5BCA8">
          9 SPRACHEN • LIVE SPORT TICKER • FINANZMÄRKTE
        </text>
        <text x="460" y="300" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-size="24" fill="#C5BCA8">
          COMMUNITY NOTES &amp; OFFENE QUELLEN
        </text>
      </g>

      <!-- Clean URL Call to Action -->
      <g transform="translate(80, 1260)">
        <rect width="920" height="180" fill="#EAE5DA" stroke="#111111" stroke-width="3"/>
        <text x="460" y="75" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-size="26" font-weight="700" fill="#111111" letter-spacing="3">DIREKT IM BROWSER ÖFFNEN:</text>
        <text x="460" y="135" text-anchor="middle" font-family="Georgia, serif" font-size="52" font-weight="900" fill="#111111" letter-spacing="4">plain-news.ch</text>
      </g>

      <line x1="80" y1="1760" x2="1000" y2="1760" stroke="#111111" stroke-width="1.5"/>
      <text x="80" y="1815" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">LINK IN DER BIO</text>
      <text x="1000" y="1815" text-anchor="end" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="700" fill="#111111" letter-spacing="2">plain-news.ch</text>
    </svg>`;
  }

  const framePng = path.join(EDITORIAL_FRAMES_DIR, `f_${String(frame).padStart(5, '0')}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 4 }).toFile(framePng);
  if (frame % 60 === 0) {
    console.log(`Rendered editorial frame ${frame}/${totalFrames} (${Math.round((frame / totalFrames) * 100)}%)`);
  }
}

console.log('Frames rendered! Compiling final Swiss Modernism MP4 video with FFmpeg...');

const ffmpegPath = 'C:\\Users\\Simon\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe';
const finalMp4 = path.join(OUTPUT_DIR, 'plain_swiss_editorial.mp4');

const cmd = `"${ffmpegPath}" -y -framerate ${FPS} -i "${path.join(EDITORIAL_FRAMES_DIR, 'f_%05d.png')}" -i "${audioFile}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 19 -c:a aac -b:a 192k -shortest "${finalMp4}"`;
execSync(cmd, { stdio: 'inherit' });

console.log('SWISS MODERNISM EDITORIAL VIDEO RENDERED SUCCESSFULLY:', finalMp4);
