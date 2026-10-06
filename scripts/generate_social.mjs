import fs from 'fs';
import path from 'path';

// Social Post Generator for Instagram & TikTok (0€ Budget, Pure Organic, Anti-Slop)
const OUTPUT_DIR = path.join(process.cwd(), 'social_content');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const index = JSON.parse(fs.readFileSync('content/index.json', 'utf8'));

// Format Instagram Carousel Slides as sharp, clean HTML/SVG cards
function renderSlideSVG({ headline, category, facts = [], slideNum, totalSlides, brand = 'PLAIN.' }) {
  const factLines = facts.map((f, i) => `
    <g transform="translate(60, ${440 + i * 110})">
      <rect x="0" y="0" width="8" height="8" fill="#111111" />
      <text x="24" y="8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="500" fill="#111111">
        ${f.slice(0, 75)}${f.length > 75 ? '…' : ''}
      </text>
    </g>
  `).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
    <!-- Paper background -->
    <rect width="1080" height="1350" fill="#EAE3D2"/>
    
    <!-- Header Rule -->
    <line x1="60" y1="120" x2="1020" y2="120" stroke="#111111" stroke-width="3"/>
    
    <!-- Masthead -->
    <text x="60" y="90" font-family="'Times New Roman', Georgia, serif" font-size="36" font-weight="900" letter-spacing="2" fill="#111111">${brand}</text>
    <text x="1020" y="90" text-anchor="end" font-family="Courier, monospace" font-size="22" font-weight="700" fill="#666666">${slideNum} / ${totalSlides}</text>

    <!-- Category Pill -->
    <rect x="60" y="160" width="${category.length * 18 + 32}" height="38" fill="#111111"/>
    <text x="76" y="186" font-family="Courier, monospace" font-size="18" font-weight="700" fill="#EAE3D2" letter-spacing="1">${category.toUpperCase()}</text>

    <!-- Main Headline -->
    <text x="60" y="270" font-family="'Times New Roman', Georgia, serif" font-size="52" font-weight="bold" fill="#111111">
      ${headline.slice(0, 42)}
    </text>
    <text x="60" y="335" font-family="'Times New Roman', Georgia, serif" font-size="52" font-weight="bold" fill="#111111">
      ${headline.slice(42, 85)}${headline.length > 85 ? '…' : ''}
    </text>

    <line x1="60" y1="380" x2="1020" y2="380" stroke="#111111" stroke-width="1.5"/>

    <!-- Key Facts -->
    ${factLines}

    <!-- Bottom Footer Box -->
    <line x1="60" y1="1200" x2="1020" y2="1200" stroke="#111111" stroke-width="3"/>
    <text x="60" y="1250" font-family="Courier, monospace" font-size="20" font-weight="700" fill="#111111">0 WERBUNG. 0 MEINUNGSMACHE. 2+ QUELLEN PFLICHT.</text>
    <text x="1020" y="1250" text-anchor="end" font-family="Courier, monospace" font-size="20" font-weight="700" fill="#111111">plain-news.ch</text>
  </svg>`;
}

// Generate Content Kits for Top 3 Stories
const topStories = index.articles.slice(0, 3);
const kits = [];

for (const story of topStories) {
  const de = story.locales.de || story.locales.en;
  const slug = story.slug;
  const cat = story.category;
  
  // 1. Instagram Carousel SVG (Slide 1: Hook & Core Facts)
  const slide1Svg = renderSlideSVG({
    headline: de.title,
    category: cat,
    facts: de.facts.slice(0, 5),
    slideNum: 1,
    totalSlides: 3,
  });
  
  fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}-slide1.svg`), slide1Svg);

  // 2. TikTok / Reels Script (Anti-Slop, No Cringe, High-Retention)
  const tiktokScript = `=======================================================
TIKTOK / REELS / SHORTS SCRIPT (Format: 9:16, 25-35 Sek.)
THEMA: ${de.title}
RESSORT: ${cat.toUpperCase()}
LINK: plain-news.ch/de/a/${slug}
=======================================================

[0-3 Sek.] HOOK (Auf den Punkt, Bildschirm zeigt Website-Schlagzeile):
"Kein Clickbait, keine Meinungsmache: Hier ist, was heute in ${cat === 'science' ? 'der Wissenschaft' : cat === 'health' ? 'der Medizin' : 'der Welt'} wirklich passiert ist."

[4-15 Sek.] DIE FAKTEN (Direkt aus den Primärquellen):
${de.facts.slice(0, 3).map((f, i) => `Point ${i + 1}: "${f}"`).join('\n')}

[16-25 Sek.] DER KONTEXT:
"${de.dek}"

[26-30 Sek.] CALL TO ACTION (Anti-Spin):
"Den vollständigen Bericht mit dem Vergleich der Original-Quellen gibt's ohne Werbung, ohne Tracking auf plain-news.ch."

-------------------------------------------------------
CAPTION / POSTING-TEXT:
${de.title} 📰

Die wichtigsten Fakten ohne Wertung:
${de.facts.slice(0, 3).map(f => `• ${f}`).join('\n')}

Quellenvergleich und Bericht ohne Werbung auf: plain-news.ch

#news #nachrichten #fakten #${cat} #schweiz #deutschland #plainnews #wissen #journalismus #nobelpreis
=======================================================\n`;

  fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}-script.txt`), tiktokScript, 'utf8');

  kits.push({ slug, title: de.title, cat });
}

console.log('Successfully generated viral campaign assets in /social_content:');
kits.forEach(k => console.log(`✓ [${k.cat.toUpperCase()}] ${k.title}`));
