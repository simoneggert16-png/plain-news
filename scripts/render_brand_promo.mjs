import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';

const OUTPUT_DIR = path.join(process.cwd(), 'social_content');
const PROMO_FRAMES_DIR = path.join(OUTPUT_DIR, 'promo_frames');
if (!fs.existsSync(PROMO_FRAMES_DIR)) fs.mkdirSync(PROMO_FRAMES_DIR, { recursive: true });

// 1. Script Voiceover
const SCRIPT_TEXT = "Nachrichten heute sind kaputt. Clickbait, nervige Werbebanner, endlose Paywalls und Meinungsmache. Wir haben plain gebaut. Die erste Nachrichtenplattform mit null Werbung, null Tracking und null Meinungsmache. Jeder Bericht wird von mindestens zwei unabhängigen Weltagenturen bestätigt. Vergleiche die Original-Schlagzeilen und lies nur noch geprüfte Fakten. Komplett kostenlos für immer auf plain-news Punkt c h.";

const audioFile = path.join(OUTPUT_DIR, 'promo_voice.mp3');
console.log('Generating neural voice with edge-tts (de-DE-KillianNeural)...');
execSync(`edge-tts --voice de-DE-KillianNeural --rate="+6%" --text "${SCRIPT_TEXT}" --write-media "${audioFile}"`, { stdio: 'inherit' });

// Get exact audio duration
const ffprobe = 'C:\\Users\\Simon\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffprobe.exe';
const durationStr = execSync(`"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`, { encoding: 'utf8' }).trim();
const totalDuration = parseFloat(durationStr) || 24.0;
console.log(`Audio duration: ${totalDuration.toFixed(2)}s`);

// 2. Motion Design Settings (30 FPS)
const FPS = 30;
const totalFrames = Math.round(totalDuration * FPS);

// Scenes definition:
// Scene 1 (0 to 6.2s): The Problem ("Nachrichten heute sind kaputt: Clickbait, Werbung, Paywalls...")
// Scene 2 (6.2s to 12.5s): The Solution ("Wir haben PLAIN gebaut: 0 Werbung, 0 Tracking, 0 Spin...")
// Scene 3 (12.5s to 18.5s): The Mechanism ("Mindestens 2 unabhängige Quellen, Framing-Vergleich...")
// Scene 4 (18.5s to end): Call to Action ("Komplett kostenlos für immer auf plain-news.ch")

console.log(`Rendering ${totalFrames} animated motion frames (1080x1920)...`);

// Helper for smooth easing
function easeOutQuad(t) { return t * (2 - t); }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

for (let frame = 0; frame < totalFrames; frame++) {
  const time = frame / FPS;
  let svg = '';

  if (time < 6.2) {
    // ── SCENE 1: THE PROBLEM ──
    const sceneProg = clamp(time / 6.2, 0, 1);
    const pop1 = clamp((time - 0.5) / 0.8, 0, 1);
    const pop2 = clamp((time - 1.8) / 0.8, 0, 1);
    const pop3 = clamp((time - 3.2) / 0.8, 0, 1);
    const shake = Math.sin(time * 30) * (time > 4.5 ? 4 : 0);

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <rect width="1080" height="1920" fill="#141414"/>
      
      <!-- Warning Grid -->
      <g stroke="#262626" stroke-width="1.5">
        <line x1="80" y1="0" x2="80" y2="1920"/>
        <line x1="1000" y1="0" x2="1000" y2="1920"/>
        <line x1="0" y1="200" x2="1080" y2="200"/>
        <line x1="0" y1="1720" x2="1080" y2="1720"/>
      </g>

      <!-- Badge -->
      <rect x="80" y="260" width="340" height="48" fill="#e63946"/>
      <text x="100" y="293" font-family="Courier, monospace" font-size="22" font-weight="900" fill="#ffffff" letter-spacing="2">SYSTEMFEHLER</text>

      <!-- Giant Bold Title -->
      <g transform="translate(${shake}, 0)">
        <text x="80" y="440" font-family="'Impact', Arial Black, sans-serif" font-size="88" fill="#ffffff" letter-spacing="2">NACHRICHTEN</text>
        <text x="80" y="540" font-family="'Impact', Arial Black, sans-serif" font-size="88" fill="#e63946" letter-spacing="2">SIND KAPUTT.</text>
      </g>

      <!-- Problem Cards Popups -->
      ${pop1 > 0 ? `
        <g transform="translate(80, ${680 + (1 - easeOutQuad(pop1)) * 40})" opacity="${pop1}">
          <rect width="920" height="140" fill="#202020" stroke="#e63946" stroke-width="2"/>
          <text x="40" y="85" font-family="Courier, monospace" font-size="36" font-weight="900" fill="#ffffff">✕ CLICKBAIT &amp; FAKE-HYPES</text>
        </g>
      ` : ''}

      ${pop2 > 0 ? `
        <g transform="translate(80, ${860 + (1 - easeOutQuad(pop2)) * 40})" opacity="${pop2}">
          <rect width="920" height="140" fill="#202020" stroke="#e63946" stroke-width="2"/>
          <text x="40" y="85" font-family="Courier, monospace" font-size="36" font-weight="900" fill="#ffffff">✕ WERBUNG &amp; TRACKING-FLUT</text>
        </g>
      ` : ''}

      ${pop3 > 0 ? `
        <g transform="translate(80, ${1040 + (1 - easeOutQuad(pop3)) * 40})" opacity="${pop3}">
          <rect width="920" height="140" fill="#202020" stroke="#e63946" stroke-width="2"/>
          <text x="40" y="85" font-family="Courier, monospace" font-size="36" font-weight="900" fill="#ffffff">✕ PAYWALLS &amp; MEINUNGSMACHE</text>
        </g>
      ` : ''}

      <!-- Bottom Ticker -->
      <rect x="0" y="1760" width="1080" height="80" fill="#202020"/>
      <text x="${1080 - (time * 280) % 1800}" y="1812" font-family="Courier, monospace" font-size="28" font-weight="700" fill="#888888">
        +++ REIZÜBERFLUTUNG +++ PARTEIPROPAGANDA +++ ALGORITHMEN ZWINGEN ZU EMPÖRUNG +++
      </text>
    </svg>`;

  } else if (time < 12.5) {
    // ── SCENE 2: THE REVOLUTION (PLAIN. HERO REVEAL) ──
    const sceneProg = clamp((time - 6.2) / 6.3, 0, 1);
    const slideUp = easeOutQuad(clamp((time - 6.4) / 0.8, 0, 1));
    const meterProg = clamp((time - 8.0) / 2.0, 0, 1);

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <!-- Newspaper Paper Background -->
      <rect width="1080" height="1920" fill="#EAE3D2"/>

      <!-- Framing Box -->
      <rect x="50" y="50" width="980" height="1820" fill="none" stroke="#111111" stroke-width="4"/>
      <rect x="62" y="62" width="956" height="1796" fill="none" stroke="#111111" stroke-width="1.5"/>

      <!-- Masthead -->
      <g transform="translate(0, ${(1 - slideUp) * 50})" opacity="${slideUp}">
        <text x="100" y="200" font-family="'Times New Roman', Georgia, serif" font-size="110" font-weight="900" letter-spacing="4" fill="#111111">PLAIN<tspan fill="#776f5f">.</tspan></text>
        <line x1="90" y1="240" x2="990" y2="240" stroke="#111111" stroke-width="4"/>
        <text x="100" y="290" font-family="Courier, monospace" font-size="26" font-weight="700" fill="#555555" letter-spacing="1">RADIKAL NEUTRALE NACHRICHTEN</text>
      </g>

      <!-- Feature Badges -->
      <g transform="translate(100, 420)">
        <rect x="0" y="0" width="280" height="70" fill="#111111"/>
        <text x="140" y="45" text-anchor="middle" font-family="Courier, monospace" font-size="28" font-weight="900" fill="#EAE3D2">0 WERBUNG</text>

        <rect x="300" y="0" width="280" height="70" fill="#111111"/>
        <text x="440" y="45" text-anchor="middle" font-family="Courier, monospace" font-size="28" font-weight="900" fill="#EAE3D2">0 TRACKING</text>

        <rect x="600" y="0" width="280" height="70" fill="#111111"/>
        <text x="740" y="45" text-anchor="middle" font-family="Courier, monospace" font-size="28" font-weight="900" fill="#EAE3D2">0 SPIN</text>
      </g>

      <!-- Center Hero Statement -->
      <g transform="translate(100, 620)">
        <rect width="880" height="480" fill="#DFD7C2" stroke="#111111" stroke-width="3"/>
        <text x="60" y="100" font-family="'Times New Roman', Georgia, serif" font-size="52" font-weight="bold" fill="#111111">Information pur.</text>
        <text x="60" y="165" font-family="'Times New Roman', Georgia, serif" font-size="52" font-weight="bold" fill="#111111">Ohne Lärm.</text>
        <line x1="60" y1="210" x2="820" y2="210" stroke="#111111" stroke-width="1.5"/>

        <text x="60" y="280" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="500" fill="#111111">
          • Keine Meinungen von Kolumnisten
        </text>
        <text x="60" y="345" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="500" fill="#111111">
          • Keine Empörungs-Trigger
        </text>
        <text x="60" y="410" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="500" fill="#111111">
          • 100% verifizierte Primärfakten
        </text>
      </g>

      <!-- Progress Meter -->
      <g transform="translate(100, 1220)">
        <text x="0" y="0" font-family="Courier, monospace" font-size="24" font-weight="700" fill="#111111">FAKTENDICHTE</text>
        <rect x="0" y="20" width="880" height="30" fill="#cccccc" stroke="#111111" stroke-width="2"/>
        <rect x="0" y="20" width="${880 * meterProg}" height="30" fill="#111111"/>
        <text x="880" y="0" text-anchor="end" font-family="Courier, monospace" font-size="24" font-weight="900" fill="#111111">${Math.round(meterProg * 100)}% VERIFIZIERT</text>
      </g>

      <line x1="90" y1="1680" x2="990" y2="1680" stroke="#111111" stroke-width="3"/>
      <text x="540" y="1750" text-anchor="middle" font-family="Courier, monospace" font-size="32" font-weight="900" fill="#111111" letter-spacing="3">WWW.PLAIN-NEWS.CH</text>
    </svg>`;

  } else if (time < 18.5) {
    // ── SCENE 3: THE ENGINE (2-SOURCE RULE & FRAMING) ──
    const sceneProg = clamp((time - 12.5) / 6.0, 0, 1);
    const boxAnim = easeOutQuad(clamp((time - 13.0) / 0.8, 0, 1));
    const pulse = 1 + Math.sin(time * 6) * 0.03;

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <rect width="1080" height="1920" fill="#EAE3D2"/>

      <rect x="50" y="50" width="980" height="1820" fill="none" stroke="#111111" stroke-width="4"/>
      <line x1="90" y1="200" x2="990" y2="200" stroke="#111111" stroke-width="3"/>
      <text x="100" y="160" font-family="'Times New Roman', Georgia, serif" font-size="70" font-weight="900" fill="#111111">DAS REDAKTIONS-PRINZIP</text>

      <!-- Two Source Rule Highlight -->
      <g transform="translate(100, 300)">
        <rect width="880" height="260" fill="#111111"/>
        <text x="440" y="90" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="56" font-weight="bold" fill="#EAE3D2">DIE 2-QUELLEN-PFLICHT</text>
        <line x1="80" y1="130" x2="800" y2="130" stroke="#776f5f" stroke-width="2"/>
        <text x="440" y="185" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="30" fill="#EAE3D2">
          Kein Artikel ohne Gegenbestätigung
        </text>
        <text x="440" y="225" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="30" fill="#EAE3D2">
          von mindestens zwei globalen Agenturen.
        </text>
      </g>

      <!-- Framing Revealer Feature Card -->
      <g transform="translate(100, 640)">
        <text x="0" y="40" font-family="Courier, monospace" font-size="28" font-weight="900" fill="#111111">FRAMING OFFENGELEGT:</text>
        <text x="0" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" fill="#555555">
          Sieh sofort, wie Medien dieselbe Story framen:
        </text>

        <!-- Simulated Headline Comparison Cards -->
        <g transform="translate(0, 120)">
          <rect width="880" height="110" fill="#DFD7C2" stroke="#111111" stroke-width="2"/>
          <text x="30" y="45" font-family="Courier, monospace" font-size="20" font-weight="700" fill="#776f5f">MEDIUM A (DRAMATISIERT):</text>
          <text x="30" y="85" font-family="'Times New Roman', Georgia, serif" font-size="30" font-weight="bold" fill="#111111">„Katastrophaler Zusammenbruch droht!“</text>
        </g>

        <g transform="translate(0, 260)">
          <rect width="880" height="110" fill="#DFD7C2" stroke="#111111" stroke-width="2"/>
          <text x="30" y="45" font-family="Courier, monospace" font-size="20" font-weight="700" fill="#776f5f">MEDIUM B (PARTEIISCH):</text>
          <text x="30" y="85" font-family="'Times New Roman', Georgia, serif" font-size="30" font-weight="bold" fill="#111111">„Regierung meistert Krise souverän!“</text>
        </g>

        <!-- PLAIN. Verdict Card -->
        <g transform="translate(0, 420)">
          <rect width="880" height="140" fill="#111111"/>
          <text x="30" y="50" font-family="Courier, monospace" font-size="22" font-weight="900" fill="#4ade80">PLAIN. FAKTEN-EXTRACT:</text>
          <text x="30" y="100" font-family="'Times New Roman', Georgia, serif" font-size="32" font-weight="bold" fill="#ffffff">
            „Inflation sinkt um 0,2% im März (Statistisches Bundesamt)“
          </text>
        </g>
      </g>

      <line x1="90" y1="1680" x2="990" y2="1680" stroke="#111111" stroke-width="3"/>
      <text x="540" y="1750" text-anchor="middle" font-family="Courier, monospace" font-size="32" font-weight="900" fill="#111111" letter-spacing="3">WWW.PLAIN-NEWS.CH</text>
    </svg>`;

  } else {
    // ── SCENE 4: CALL TO ACTION (VIRAL CONVERSION) ──
    const sceneProg = clamp((time - 18.5) / (totalDuration - 18.5), 0, 1);
    const pulse = 1 + Math.sin(time * 8) * 0.02;

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <rect width="1080" height="1920" fill="#EAE3D2"/>

      <rect x="50" y="50" width="980" height="1820" fill="none" stroke="#111111" stroke-width="4"/>
      <rect x="62" y="62" width="956" height="1796" fill="none" stroke="#111111" stroke-width="1.5"/>

      <text x="540" y="320" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="140" font-weight="900" letter-spacing="6" fill="#111111">PLAIN<tspan fill="#776f5f">.</tspan></text>
      <text x="540" y="400" text-anchor="middle" font-family="Courier, monospace" font-size="32" font-weight="700" fill="#555555">NEWS WITHOUT NOISE</text>

      <line x1="120" y1="460" x2="960" y2="460" stroke="#111111" stroke-width="3"/>

      <!-- Manifesto Box -->
      <g transform="translate(100, 540)">
        <rect width="880" height="540" fill="#DFD7C2" stroke="#111111" stroke-width="3"/>

        <text x="60" y="100" font-family="'Times New Roman', Georgia, serif" font-size="44" font-weight="bold" fill="#111111">Kostenlos für immer.</text>
        <text x="60" y="160" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" fill="#333333">Keine Abonnements, keine Registrierungspflicht.</text>

        <line x1="60" y1="210" x2="820" y2="210" stroke="#111111" stroke-width="1.5"/>

        <text x="60" y="280" font-family="'Times New Roman', Georgia, serif" font-size="44" font-weight="bold" fill="#111111">In 9 Sprachen verfügbar.</text>
        <text x="60" y="340" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" fill="#333333">Weltnachrichten, Sport-Liveticker, Märkte &amp; Wissenschaft.</text>

        <line x1="60" y1="390" x2="820" y2="390" stroke="#111111" stroke-width="1.5"/>

        <text x="60" y="460" font-family="'Times New Roman', Georgia, serif" font-size="44" font-weight="bold" fill="#111111">Community-Debatte.</text>
        <text x="60" y="510" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" fill="#333333">Faktenbasierte Kommentare &amp; offene Quellen.</text>
      </g>

      <!-- Massive Action CTA Button -->
      <g transform="translate(100, 1240)">
        <rect width="880" height="180" fill="#111111" stroke="#111111" stroke-width="4"/>
        <text x="440" y="90" text-anchor="middle" font-family="Courier, monospace" font-size="40" font-weight="900" fill="#EAE3D2" letter-spacing="4">JETZT IM BROWSER:</text>
        <text x="440" y="145" text-anchor="middle" font-family="Courier, monospace" font-size="48" font-weight="900" fill="#ffffff" letter-spacing="6">PLAIN-NEWS.CH</text>
      </g>

      <!-- Bottom Audio Indicator -->
      <g transform="translate(100, 1560)">
        <text x="440" y="0" text-anchor="middle" font-family="Courier, monospace" font-size="24" font-weight="700" fill="#555555">
          SPEICHERE DIR DIESES VIDEO &amp; FOLGE FÜR FAKTEN
        </text>
      </g>

      <line x1="90" y1="1720" x2="990" y2="1720" stroke="#111111" stroke-width="3"/>
      <text x="540" y="1790" text-anchor="middle" font-family="Courier, monospace" font-size="32" font-weight="900" fill="#111111" letter-spacing="3">LINK IN BIO: PLAIN-NEWS.CH</text>
    </svg>`;
  }

  const framePng = path.join(PROMO_FRAMES_DIR, `f_${String(frame).padStart(5, '0')}.png`);
  // Render PNG with Sharp
  await sharp(Buffer.from(svg)).png({ compressionLevel: 4 }).toFile(framePng);
  if (frame % 60 === 0) {
    console.log(`Rendered frame ${frame}/${totalFrames} (${Math.round((frame / totalFrames) * 100)}%)`);
  }
}

console.log('All motion frames rendered! Assembling final MP4 with FFmpeg...');

const ffmpegPath = 'C:\\Users\\Simon\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe';
const finalMp4 = path.join(OUTPUT_DIR, 'plain_brand_promo.mp4');

const cmd = `"${ffmpegPath}" -y -framerate ${FPS} -i "${path.join(PROMO_FRAMES_DIR, 'f_%05d.png')}" -i "${audioFile}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 20 -c:a aac -b:a 192k -shortest "${finalMp4}"`;
execSync(cmd, { stdio: 'inherit' });

console.log('MOTION GRAPHICS PROMO CLIP COMPLETE! Saved to:', finalMp4);
