import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const sampleRate = 48000;
const numChannels = 2;

function createWavHeader(totalFrames) {
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + totalFrames * numChannels * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * 2, 28);
  buffer.writeUInt16LE(numChannels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(totalFrames * numChannels * 2, 40);
  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK 1: Dark Minimalist Tech & Sub-Bass Drop (120 BPM, C Minor)
// For: 01_PLAIN_Master_Ad_30s.mp4
// ─────────────────────────────────────────────────────────────────────────────
function renderTrack1(duration = 30.1) {
  const totalFrames = Math.floor(sampleRate * duration);
  const dataBuf = Buffer.alloc(totalFrames * numChannels * 2);
  const bpm = 120;
  const beatSec = 60 / bpm; // 0.5s
  const sixteenth = beatSec / 4;

  const chords = [
    [130.81, 155.56, 196.00], // Cm
    [103.83, 130.81, 155.56], // Ab
    [87.31,  103.83, 130.81], // Fm
    [98.00,  123.47, 146.83], // G
  ];

  let offset = 0;
  for (let i = 0; i < totalFrames; i++) {
    const t = i / sampleRate;
    let L = 0, R = 0;

    // Intro chaos / riser (0 - 4.5s)
    if (t < 4.5) {
      const tick = t % sixteenth;
      if (tick < 0.02) {
        const c = Math.sin(2 * Math.PI * 3400 * tick) * Math.exp(-tick * 320);
        L += c * 0.35; R += c * 0.35;
      }
      const drone = (Math.sin(2 * Math.PI * 55 * t) + 0.5 * Math.sin(2 * Math.PI * 110 * t)) * Math.min(1, t / 2) * 0.25;
      L += drone; R += drone;
      if (t > 2.0) {
        const sweepFrac = (t - 2.0) / 2.5;
        const sw = Math.sin(2 * Math.PI * (100 + Math.pow(sweepFrac, 2) * 850) * t) * sweepFrac * 0.32;
        L += sw * 0.8; R += sw * 1.2;
      }
    }

    // Heavy 808 Sub drop at 4.5s
    if (t >= 4.45 && t < 7.5) {
      const dt = t - 4.45;
      const sub = Math.sin(2 * Math.PI * Math.max(38, 120 * Math.exp(-dt * 4)) * dt) * Math.exp(-dt * 1.6) * 0.75;
      L += sub; R += sub;
    }

    // Main Beat (4.5s - 26s)
    if (t >= 4.5 && t < 26.0) {
      const bt = t - 4.5;
      const beat = Math.floor(bt / beatSec);
      const kp = bt % beatSec;

      // Kick
      if (kp < 0.18) {
        const kf = 115 * Math.exp(-kp * 26) + 40;
        const kick = Math.sin(2 * Math.PI * kf * kp) * Math.exp(-kp * 14) * 0.6;
        L += kick; R += kick;
      }

      // Snare / Clack
      if ((beat % 4 === 1 || beat % 4 === 3) && kp < 0.15) {
        const sn = ((Math.random() * 2 - 1) * Math.exp(-kp * 24) * 0.26) + (Math.sin(2 * Math.PI * 220 * kp) * Math.exp(-kp * 20) * 0.22);
        L += sn; R += sn;
      }

      // Hi-hat
      const hp = bt % sixteenth;
      if (hp < 0.04) {
        const hat = (Math.random() * 2 - 1) * Math.exp(-hp * 105) * 0.16;
        L += hat * 0.7; R += hat * 1.3;
      }

      // Bassline (8th notes)
      const chordIdx = Math.floor(bt / (beatSec * 4)) % chords.length;
      const rf = chords[chordIdx][0] / 2;
      const bp = bt % (beatSec / 2);
      const bass = (Math.sin(2 * Math.PI * rf * bp) + 0.35 * Math.sin(2 * Math.PI * rf * 2 * bp)) * Math.exp(-bp * 6) * 0.45;
      L += bass; R += bass;

      // Telemetry blips every 4s
      const relT = (t - 4.5) % 4.0;
      if (relT < 0.08) {
        const blip = Math.sin(2 * Math.PI * 1900 * relT) * Math.exp(-relT * 40) * 0.22;
        L += blip; R += blip;
      }
    }

    // Outro
    if (t >= 26.0) {
      const ot = t - 26.0;
      const fade = Math.max(0, 1 - ot / 4.1);
      const bell = (Math.sin(2 * Math.PI * 523.25 * ot) * 0.35 + Math.sin(2 * Math.PI * 783.99 * ot) * 0.25) * Math.exp(-ot * 0.8);
      L += bell * fade; R += bell * fade;
    }

    L = Math.max(-0.95, Math.min(0.95, L));
    R = Math.max(-0.95, Math.min(0.95, R));
    dataBuf.writeInt16LE(Math.floor(L * 32767), offset);
    dataBuf.writeInt16LE(Math.floor(R * 32767), offset + 2);
    offset += 4;
  }

  return Buffer.concat([createWavHeader(totalFrames), dataBuf]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK 2: Cinematic Lo-Fi Tape & Warm Ambient Rhodes (92 BPM, F Minor)
// For: 02_PLAIN_Brand_Promo.mp4 (Sophisticated, prestigious, calm authority)
// ─────────────────────────────────────────────────────────────────────────────
function renderTrack2(duration = 28.0) {
  const totalFrames = Math.floor(sampleRate * duration);
  const dataBuf = Buffer.alloc(totalFrames * numChannels * 2);
  const bpm = 92;
  const beatSec = 60 / bpm; // ~0.652s
  const eighth = beatSec / 2;

  // F minor warm progression (Fm9, Dbmaj7, Bbm7, C7b9)
  const fChords = [
    [174.61, 207.65, 261.63, 349.23], // Fm
    [138.59, 174.61, 207.65, 261.63], // Db
    [116.54, 138.59, 174.61, 207.65], // Bbm
    [130.81, 164.81, 196.00, 246.94], // C7
  ];

  let offset = 0;
  for (let i = 0; i < totalFrames; i++) {
    const t = i / sampleRate;
    let L = 0, R = 0;

    // Subtle analog tape hiss & vinyl warmth
    const tapeHiss = (Math.random() * 2 - 1) * 0.015;
    L += tapeHiss; R += tapeHiss;

    const beatPhase = (t % beatSec) / beatSec;
    const curBeat = Math.floor(t / beatSec);

    // Warm, rounded Lo-Fi Kick on beats 1 and 3 (subtle, acoustic feel)
    const kPhase = t % (beatSec * 2);
    if (kPhase < 0.22) {
      const kf = 85 * Math.exp(-kPhase * 20) + 38;
      const kick = Math.sin(2 * Math.PI * kf * kPhase) * Math.exp(-kPhase * 11) * 0.48;
      L += kick; R += kick;
    }

    // Rimshot / Wooden Snare on beat 2 and 4
    if ((curBeat % 2 === 1) && (t % beatSec) < 0.12) {
      const sp = t % beatSec;
      const rim = (Math.sin(2 * Math.PI * 480 * sp) * 0.2 + (Math.random() * 2 - 1) * 0.18) * Math.exp(-sp * 28);
      L += rim * 0.85; R += rim * 1.15;
    }

    // Soft Shaker on 8th notes
    const shkPhase = t % (eighth / 2);
    if (shkPhase < 0.035) {
      const shk = (Math.random() * 2 - 1) * Math.exp(-shkPhase * 120) * 0.09;
      L += shk * 1.2; R += shk * 0.8;
    }

    // Warm Rhodes electric piano chords
    const chordIdx = Math.floor(t / (beatSec * 4)) % fChords.length;
    const chord = fChords[chordIdx];
    const tremolo = 1 + 0.15 * Math.sin(2 * Math.PI * 4.5 * t);

    chord.forEach((freq, idx) => {
      // Sine + soft triangle warmth
      const wave = Math.sin(2 * Math.PI * freq * t) + 0.2 * Math.sin(2 * Math.PI * freq * 2 * t);
      const pan = idx % 2 === 0 ? 0.8 : 1.2;
      L += wave * 0.065 * tremolo * pan;
      R += wave * 0.065 * tremolo * (2 - pan);
    });

    // Deep warm Sub-Bass (round, warm sine pulse)
    const root = chord[0] / 2; // around 58-87 Hz
    const bPhase = t % beatSec;
    const bass = Math.sin(2 * Math.PI * root * bPhase) * Math.exp(-bPhase * 3.5) * 0.38;
    L += bass; R += bass;

    // Smooth fade out
    if (t > duration - 2.5) {
      const fade = Math.max(0, (duration - t) / 2.5);
      L *= fade; R *= fade;
    }

    L = Math.max(-0.95, Math.min(0.95, L));
    R = Math.max(-0.95, Math.min(0.95, R));
    dataBuf.writeInt16LE(Math.floor(L * 32767), offset);
    dataBuf.writeInt16LE(Math.floor(R * 32767), offset + 2);
    offset += 4;
  }

  return Buffer.concat([createWavHeader(totalFrames), dataBuf]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK 3: Swiss Precision Electronic Groove (126 BPM, Minimalist Tech-House)
// For: 03_PLAIN_Platform_Tour.mp4 (Energetic, modern product showcase)
// ─────────────────────────────────────────────────────────────────────────────
function renderTrack3(duration = 26.8) {
  const totalFrames = Math.floor(sampleRate * duration);
  const dataBuf = Buffer.alloc(totalFrames * numChannels * 2);
  const bpm = 126;
  const beatSec = 60 / bpm; // ~0.476s
  const sixteenth = beatSec / 4;

  // Minimal techno synth hook notes (A minor / D minor precision)
  const notes = [220, 261.63, 293.66, 329.63, 392.00];

  let offset = 0;
  for (let i = 0; i < totalFrames; i++) {
    const t = i / sampleRate;
    let L = 0, R = 0;

    const curBeat = Math.floor(t / beatSec);
    const kp = t % beatSec;

    // Tight German/Swiss Four-on-the-Floor Kick
    if (kp < 0.16) {
      const kf = 135 * Math.exp(-kp * 30) + 48;
      const kick = Math.sin(2 * Math.PI * kf * kp) * Math.exp(-kp * 16) * 0.65;
      L += kick; R += kick;
    }

    // Offbeat Open Hi-Hat (on the "&" between beats)
    const offbeatTime = (t - beatSec / 2) % beatSec;
    if (offbeatTime >= 0 && offbeatTime < 0.08) {
      const oh = (Math.random() * 2 - 1) * Math.exp(-offbeatTime * 45) * 0.22;
      L += oh * 0.85; R += oh * 1.15;
    }

    // Crisp Closed Hats on 16ths
    const hp = t % sixteenth;
    if (hp < 0.025) {
      const ch = (Math.random() * 2 - 1) * Math.exp(-hp * 140) * 0.14;
      L += ch * 1.1; R += ch * 0.9;
    }

    // Bouncy Rolling Bass Synth (16th note pattern)
    const bassIdx = Math.floor(t / sixteenth) % 4;
    const bassPattern = [110, 110, 130.81, 98.00]; // A2, A2, C3, G2
    const bp = t % sixteenth;
    if (bp < 0.1) {
      const bFreq = bassPattern[bassIdx] / 2; // ~55 Hz sub
      const bass = (Math.sin(2 * Math.PI * bFreq * bp) + 0.4 * Math.sin(2 * Math.PI * bFreq * 2 * bp)) * Math.exp(-bp * 15) * 0.42;
      L += bass; R += bass;
    }

    // Minimalist Staccato Synth Blips (Teenage Engineering style)
    const step = Math.floor(t / (sixteenth * 2)) % notes.length;
    const sp = t % (sixteenth * 2);
    if (sp < 0.05) {
      const sf = notes[step];
      const syn = Math.sin(2 * Math.PI * sf * sp) * Math.exp(-sp * 50) * 0.18;
      L += syn * 1.25; R += syn * 0.75;
    }

    // Smooth fade out
    if (t > duration - 2.0) {
      const fade = Math.max(0, (duration - t) / 2.0);
      L *= fade; R *= fade;
    }

    L = Math.max(-0.95, Math.min(0.95, L));
    R = Math.max(-0.95, Math.min(0.95, R));
    dataBuf.writeInt16LE(Math.floor(L * 32767), offset);
    dataBuf.writeInt16LE(Math.floor(R * 32767), offset + 2);
    offset += 4;
  }

  return Buffer.concat([createWavHeader(totalFrames), dataBuf]);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION: RENDER, MASTER & REMUX
// ─────────────────────────────────────────────────────────────────────────────
const outAudioDir = 'public/audio';
const desktopVideosDir = 'C:/Users/Simon/Desktop/PLAIN_Social_Media_Content/01_Videos_and_Reels';

console.log('1. Rendering 3 unique procedural WAV soundtracks...');
fs.writeFileSync(path.join(outAudioDir, 'track1_raw.wav'), renderTrack1(30.1));
fs.writeFileSync(path.join(outAudioDir, 'track2_raw.wav'), renderTrack2(28.0));
fs.writeFileSync(path.join(outAudioDir, 'track3_raw.wav'), renderTrack3(26.8));

console.log('2. Mastering each soundtrack with distinct EQ & dynamics (48kHz Stereo AAC)...');
// Master Track 1: Punchy Sub-Bass & Crisp Top (Dark Minimal)
execSync(`ffmpeg -y -i ${outAudioDir}/track1_raw.wav -af "bass=g=4:f=75,treble=g=2:f=6500,loudnorm=I=-14:LRA=7:TP=-1" -b:a 320k ${outAudioDir}/soundtrack_01_dark_minimal.mp3`, { stdio: 'inherit' });

// Master Track 2: Warm Analog Lo-Fi Tape (Sophisticated Editorial)
execSync(`ffmpeg -y -i ${outAudioDir}/track2_raw.wav -af "bass=g=3:f=90,treble=g=-1:f=8000,loudnorm=I=-15:LRA=8:TP=-1" -b:a 320k ${outAudioDir}/soundtrack_02_cinematic_lofi.mp3`, { stdio: 'inherit' });

// Master Track 3: Energetic Precision Tech Groove (Product Showcase)
execSync(`ffmpeg -y -i ${outAudioDir}/track3_raw.wav -af "bass=g=4:f=65,treble=g=3:f=7500,loudnorm=I=-13.5:LRA=6:TP=-1" -b:a 320k ${outAudioDir}/soundtrack_03_precision_beat.mp3`, { stdio: 'inherit' });

console.log('3. Remuxing the 3 ad videos with their individual soundtracks...');
const remuxPlan = [
  {
    videoSrc: 'out/plain_motion_ad_30s.mp4',
    audioSrc: `${outAudioDir}/soundtrack_01_dark_minimal.mp3`,
    outputDst: path.join(desktopVideosDir, '01_PLAIN_Master_Ad_30s.mp4'),
    duration: 30.0,
    title: '01 PLAIN Master Ad (Dark Minimalist Tech & Sub-Drop)'
  },
  {
    videoSrc: 'social_content/plain_brand_promo.mp4',
    audioSrc: `${outAudioDir}/soundtrack_02_cinematic_lofi.mp3`,
    outputDst: path.join(desktopVideosDir, '02_PLAIN_Brand_Promo.mp4'),
    duration: 27.8,
    title: '02 PLAIN Brand Promo (Cinematic Lo-Fi Tape & Rhodes)'
  },
  {
    videoSrc: 'social_content/plain_final_tour.mp4',
    audioSrc: `${outAudioDir}/soundtrack_03_precision_beat.mp3`,
    outputDst: path.join(desktopVideosDir, '03_PLAIN_Platform_Tour.mp4'),
    duration: 26.5,
    title: '03 PLAIN Platform Tour (Swiss Precision Tech Beat)'
  }
];

for (const p of remuxPlan) {
  console.log(`\nRemuxing ${p.title}...`);
  const fadeStart = (p.duration - 1.5).toFixed(1);
  const cmd = `ffmpeg -y -i "${p.videoSrc}" -i "${p.audioSrc}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -af "afade=t=out:st=${fadeStart}:d=1.5" -t ${p.duration} "${p.outputDst}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✓ Created: ${p.outputDst}`);
}

// Copy standalone audio files to Desktop folder too
fs.copyFileSync(`${outAudioDir}/soundtrack_01_dark_minimal.mp3`, path.join(desktopVideosDir, 'Soundtrack_01_Dark_Minimal_Drop.mp3'));
fs.copyFileSync(`${outAudioDir}/soundtrack_02_cinematic_lofi.mp3`, path.join(desktopVideosDir, 'Soundtrack_02_Cinematic_Lofi_Tape.mp3'));
fs.copyFileSync(`${outAudioDir}/soundtrack_03_precision_beat.mp3`, path.join(desktopVideosDir, 'Soundtrack_03_Swiss_Precision_Beat.mp3'));

// Cleanup temporary raw WAVs
['track1_raw.wav', 'track2_raw.wav', 'track3_raw.wav'].forEach(f => {
  try { fs.unlinkSync(path.join(outAudioDir, f)); } catch {}
});

console.log('\n=============================================================================');
console.log('✓ All 3 ad videos now feature distinct, custom Swiss-style soundtracks:');
console.log('  Video 1: Dark Minimalist Tech & Sub-Bass Drop (120 BPM)');
console.log('  Video 2: Cinematic Lo-Fi Tape & Warm Ambient Rhodes (92 BPM)');
console.log('  Video 3: Swiss Precision Electronic Groove (126 BPM)');
console.log('  Location: C:\\Users\\Simon\\Desktop\\PLAIN_Social_Media_Content\\01_Videos_and_Reels');
console.log('=============================================================================');
