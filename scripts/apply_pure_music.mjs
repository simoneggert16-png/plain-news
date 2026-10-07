import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const targetDir = 'C:/Users/Simon/Desktop/PLAIN_Social_Media_Content/01_Videos_and_Reels';
const soundtrack = 'public/audio/plain_music_soundtrack_mastered.mp3';

const videos = [
  {
    src: 'out/plain_motion_ad_30s.mp4',
    dst: path.join(targetDir, '01_PLAIN_Master_Ad_30s.mp4'),
    duration: 30.0,
  },
  {
    src: 'social_content/plain_brand_promo.mp4',
    dst: path.join(targetDir, '02_PLAIN_Brand_Promo.mp4'),
    duration: 27.8,
  },
  {
    src: 'social_content/plain_final_tour.mp4',
    dst: path.join(targetDir, '03_PLAIN_Platform_Tour.mp4'),
    duration: 26.5,
  },
];

for (const v of videos) {
  console.log(`Remuxing: ${v.src} -> ${v.dst}`);
  const fadeStart = (v.duration - 1.5).toFixed(1);
  const cmd = `ffmpeg -y -i "${v.src}" -i "${soundtrack}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -af "afade=t=out:st=${fadeStart}:d=1.5" -t ${v.duration} "${v.dst}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✓ Completed: ${v.dst}`);
}

console.log('\nAll videos updated with pure music soundtrack (0 voiceover, 100% music/beat)!');
