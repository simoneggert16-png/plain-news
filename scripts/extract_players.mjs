import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const players = [
  // Argentina (4-3-3)
  { id: 'arg-23', name: 'Emiliano Martínez', shortName: 'E. Martínez', slug: 'emiliano-martinez', jersey: '23', pos: 'TW', rating: 6.5, x: 62, y: 302, team: 'Argentina' },
  { id: 'arg-3', name: 'Nicolás Tagliafico', shortName: 'N. Tagliafico', slug: 'nicolas-tagliafico', jersey: '3', pos: 'LV', rating: 6.5, x: 186, y: 86, team: 'Argentina' },
  { id: 'arg-19', name: 'Nicolás Otamendi', shortName: 'N. Otamendi', slug: 'nicolas-otamendi', jersey: '19', pos: 'IV', rating: 6.7, x: 186, y: 230, team: 'Argentina' },
  { id: 'arg-13', name: 'Cristian Romero', shortName: 'C. Romero', slug: 'cristian-romero', jersey: '13', pos: 'IV', rating: 7.3, x: 186, y: 374, team: 'Argentina' },
  { id: 'arg-4', name: 'Agustín Giay', shortName: 'A. Giay', slug: 'agustin-giay', jersey: '4', pos: 'RV', rating: 6.9, x: 186, y: 518, team: 'Argentina' },
  { id: 'arg-8', name: 'Enzo Fernández', shortName: 'E. Fernández', slug: 'enzo-fernandez', jersey: '8', pos: 'ZM', rating: 6.7, x: 320, y: 122, team: 'Argentina' },
  { id: 'arg-20', name: 'Alexis Mac Allister', shortName: 'A. Mac Allister', slug: 'alexis-mac-allister', jersey: '20', pos: 'ZM', rating: 6.7, x: 320, y: 302, team: 'Argentina' },
  { id: 'arg-7', name: 'Rodrigo De Paul', shortName: 'R. De Paul', slug: 'rodrigo-de-paul', jersey: '7', pos: 'ZM', rating: 7.5, x: 320, y: 482, team: 'Argentina' },
  { id: 'arg-9', name: 'Julián Álvarez', shortName: 'J. Álvarez', slug: 'julian-alvarez', jersey: '9', pos: 'LA', rating: 6.7, x: 450, y: 122, team: 'Argentina' },
  { id: 'arg-22', name: 'Lautaro Martínez', shortName: 'L. Martínez', slug: 'lautaro-martinez', jersey: '22', pos: 'MS', rating: 6.9, x: 450, y: 302, team: 'Argentina' },
  { id: 'arg-10', name: 'Lionel Messi', shortName: 'L. Messi', slug: 'lionel-messi', jersey: '10', pos: 'RA', rating: 6.1, x: 450, y: 482, team: 'Argentina', isCaptain: true },

  // Benin (4-2-3-1)
  { id: 'ben-10', name: 'Aiyegun Tosin', shortName: 'A. Tosin', slug: 'aiyegun-tosin', jersey: '10', pos: 'MS', rating: 6.1, x: 558, y: 302, team: 'Benin' },
  { id: 'ben-17', name: 'Rodolfo Aloko', shortName: 'R. Aloko', slug: 'rodolfo-aloko', jersey: '17', pos: 'RA', rating: 6.9, x: 650, y: 122, team: 'Benin' },
  { id: 'ben-18', name: 'Junior Olaitan', shortName: 'J. Olaitan', slug: 'junior-olaitan', jersey: '18', pos: 'OM', rating: 6.7, x: 650, y: 302, team: 'Benin' },
  { id: 'ben-11', name: 'Yohan Ouorou', shortName: 'Y. Ouorou', slug: 'yohan-ouorou', jersey: '11', pos: 'LA', rating: 6.5, x: 650, y: 482, team: 'Benin' },
  { id: 'ben-15', name: 'Sessi D\'Almeida', shortName: 'S. D\'Almeida', slug: 'sessi-dalmeida', jersey: '15', pos: 'DM', rating: 6.5, x: 758, y: 182, team: 'Benin', isCaptain: true },
  { id: 'ben-8', name: 'Hassane Imourane', shortName: 'H. Imourane', slug: 'hassane-imourane', jersey: '8', pos: 'DM', rating: 7.0, x: 758, y: 422, team: 'Benin' },
  { id: 'ben-2', name: 'Luc Omore', shortName: 'L. Omore', slug: 'luc-omore', jersey: '2', pos: 'RV', rating: 7.1, x: 864, y: 84, team: 'Benin' },
  { id: 'ben-5', name: 'Yohan Roche', shortName: 'Y. Roche', slug: 'yohan-roche', jersey: '5', pos: 'IV', rating: 6.7, x: 864, y: 230, team: 'Benin' },
  { id: 'ben-13', name: 'Mohamed Tijani', shortName: 'M. Tijani', slug: 'mohamed-tijani', jersey: '13', pos: 'IV', rating: 7.0, x: 864, y: 374, team: 'Benin' },
  { id: 'ben-3', name: 'Tamimou Ouorou', shortName: 'T. Ouorou', slug: 'tamimou-ouorou', jersey: '3', pos: 'LV', rating: 6.5, x: 864, y: 518, team: 'Benin' },
  { id: 'ben-1', name: 'Marcel Dandjinou', shortName: 'M. Dandjinou', slug: 'marcel-dandjinou', jersey: '1', pos: 'TW', rating: 6.6, x: 964, y: 302, team: 'Benin' }
];

async function extract() {
  const outDir = path.resolve('public/sport/players');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const size = 48;
  const R = 24;
  const circleSvg = `<svg width="${size}" height="${size}"><circle cx="${R}" cy="${R}" r="${R}" fill="white" /></svg>`;
  const circleMask = Buffer.from(circleSvg);

  for (const p of players) {
    const left = Math.round(p.x - 24);
    const top = Math.round(p.y - 26); // shifts slightly up to center face and avoid badge
    const dest = path.join(outDir, `${p.slug}.png`);

    await sharp('public/sport/argentina_benin_pitch.png')
      .extract({ left, top, width: size, height: size })
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toFile(dest);
    
    console.log(`Saved ${p.name} -> ${p.slug}.png`);
  }

  // Also write the curated JSON dataset with exact positions, ratings, and avatars
  fs.writeFileSync('public/sport/lineup_data.json', JSON.stringify(players, null, 2));
  console.log('Saved lineup_data.json with all 22 players, coordinates and SofaScore ratings.');
}

extract();
