import sharp from 'sharp';
import fs from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#f4efe6" />
  <rect x="36" y="36" width="952" height="952" fill="none" stroke="#0b0c0e" stroke-width="16" />
  
  <text x="460" y="520" 
        font-family="'Inter', -apple-system, sans-serif" 
        font-weight="900" 
        font-size="220" 
        letter-spacing="-8" 
        fill="#0b0c0e" 
        text-anchor="middle">
    PLAIN
  </text>
  
  <circle cx="770" cy="495" r="30" fill="#dc2626" />

  <text x="512" y="610" 
        font-family="monospace" 
        font-weight="700" 
        font-size="34" 
        letter-spacing="6" 
        fill="#716e65" 
        text-anchor="middle">
    NEWS WITHOUT NOISE
  </text>

  <line x1="160" y1="670" x2="864" y2="670" stroke="#0b0c0e" stroke-width="4" />
  <text x="512" y="730" 
        font-family="monospace" 
        font-weight="700" 
        font-size="26" 
        letter-spacing="3" 
        fill="#0b0c0e" 
        text-anchor="middle">
    VERIFIED EVENTS · 0 SPIN
  </text>
</svg>`;

async function run() {
  await sharp(Buffer.from(svg))
    .png()
    .toFile('public/app-icon-1024.png');
  console.log('Generated public/app-icon-1024.png');
}
run();
