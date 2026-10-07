import fs from 'node:fs';
import path from 'node:path';

const targetRoot = 'C:/Users/Simon/Desktop/PLAIN_Social_Media_Content';
if (!fs.existsSync(targetRoot)) fs.mkdirSync(targetRoot, { recursive: true });

const folders = [
  '01_Videos_and_Reels',
  '02_Carousel_Batch_01_Die_5_Prinzipien',
  '03_Carousel_Batch_02_Zero_Spin',
  '04_App_Assets'
];

folders.forEach(f => {
  const p = path.join(targetRoot, f);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// 1. Copy Videos
const videoMap = [
  { src: 'out/plain_motion_ad_30s.mp4', dst: '01_Videos_and_Reels/01_PLAIN_Master_Ad_30s.mp4' },
  { src: 'social_content/plain_brand_promo.mp4', dst: '01_Videos_and_Reels/02_PLAIN_Brand_Promo.mp4' },
  { src: 'social_content/plain_final_tour.mp4', dst: '01_Videos_and_Reels/03_PLAIN_Platform_Tour.mp4' },
];

videoMap.forEach(item => {
  if (fs.existsSync(item.src)) {
    fs.copyFileSync(item.src, path.join(targetRoot, item.dst));
    console.log('✓ Copied video:', item.dst);
  }
});

// Video Caption File
const videoCaptions = `======================================================================
VIDEO 01: PLAIN MASTER AD (30 SEKUNDEN) — EMPFOHLEN FÜR TIKTOK, REELS & SHORTS
Datei: 01_PLAIN_Master_Ad_30s.mp4
======================================================================

DEUTSCHER POST-TEXT (Caption zum Kopieren):
Warum bist du nach dem Nachrichtenschauen eigentlich immer gestresst? 🚨
Weil 94% der Medien dich nicht informieren wollen — sie monetarisieren deine Panik und Wut.

PLAIN ist das radikale Gegenmittel:
✓ 0 Werbung. 0 Paywalls. 0 Tracker.
✓ 2-Quellen-Pflicht für jede Meldung.
✓ Reiner Fakten-Draht ohne Meinungsfärbung.

Lies die Nachrichten so, wie sie sein sollten:
👉 plain-news.ch

#news #nachrichten #journalismus #fakten #schweiz #deutschland #medien #politik #wissen

----------------------------------------------------------------------
ENGLISH CAPTION (Copy & Paste):
Why are you always anxious after reading the news? 🚨
Because the modern media economy doesn't want to inform you. They monetize your panic and outrage.

PLAIN is the antidote:
✓ 0 Ads. 0 Paywalls. 0 Trackers.
✓ Strict two-source verification.
✓ Zero spin, adversarial audit.

Information is a public utility, not an attention slot machine:
👉 plain-news.ch

#journalism #technews #worldnews #facts #media #unbiased #press #news
`;
fs.writeFileSync(path.join(targetRoot, '01_Videos_and_Reels/VIDEO_POSTING_TEXTS.txt'), videoCaptions, 'utf8');

// 2. Copy Batch 01 (batch-03 slides)
const batch01Files = [
  { src: 'social_content/batch-03/plain-batch-03-01-zero-trackers.png', dst: 'Slide_01_0_Werbung_0_Trackers.png' },
  { src: 'social_content/batch-03/plain-batch-03-02-unconditionally-open.png', dst: 'Slide_02_Bedingungslos_Offen.png' },
  { src: 'social_content/batch-03/plain-batch-03-03-spin-visible.png', dst: 'Slide_03_Spin_Sichtbar_Machen.png' },
  { src: 'social_content/batch-03/plain-batch-03-04-separate-editor.png', dst: 'Slide_04_Adversarial_Audit.png' },
  { src: 'social_content/batch-03/plain-batch-03-05-pure-information.png', dst: 'Slide_05_Reine_Information.png' },
];

batch01Files.forEach(f => {
  if (fs.existsSync(f.src)) {
    fs.copyFileSync(f.src, path.join(targetRoot, '02_Carousel_Batch_01_Die_5_Prinzipien', f.dst));
    console.log('✓ Copied Slide:', f.dst);
  }
});

const batch01Caption = `======================================================================
INSTAGRAM / TIKTOK KARUSSELL BATCH 01: DIE 5 PRINZIPIEN VON PLAIN
Slides in Reihenfolge 01 bis 05 hochladen
======================================================================

DEUTSCHER POST-TEXT:
0 Werbung. 0 Paywalls. 0 Tracker. 0 Abos.
Informationen sind kein Aufmerksamkeits-Kasino, sondern ein öffentliches Gut.

Die 5 Grundsätze von PLAIN:
1. Zero Spin: Sachverhalte statt Emotionen.
2. Zwei-Quellen-Pflicht: Jedes Event von mind. zwei Agenturen unabhängig geprüft.
3. Framing aufdecken: Verzerrungen von links und rechts transparent machen.
4. Bedingungslos offen: Keine Bezahlschranken, keine Cookies.
5. Gegensätzliche KI-Prüfung: Reporter und Auditor im Kreuzverhör.

Webseite: plain-news.ch

#journalismus #schweiz #nachrichten #medienkritik #fakten #plainnews #brutalism #politik

----------------------------------------------------------------------
ENGLISH CAPTION:
0 ads. 0 paywalls. 0 trackers. 0 subscriptions.
Information is a public utility, not an attention slot machine.

Meet the architecture of PLAIN:
1. Zero Spin — Fact-only reporting.
2. Two-Source Verification — Cross-checked across wires.
3. Framing Exposed — Left vs right narratives revealed.
4. Unconditionally Open — 100% accessible to everyone.
5. Adversarial AI Pipeline — Reporter challenged by an auditor.

Live now at plain-news.ch

#media #journalism #future #design #minimalism #unbiased #swissdesign
`;
fs.writeFileSync(path.join(targetRoot, '02_Carousel_Batch_01_Die_5_Prinzipien/POSTING_TEXT_BATCH_01.txt'), batch01Caption, 'utf8');

// 3. Copy Batch 02 (batch-02 slides)
const batch02Files = [
  { src: 'social_content/batch-02/plain-batch-02-01-verified-events.png', dst: 'Slide_01_Verifizierte_Ereignisse.png' },
  { src: 'social_content/batch-02/plain-batch-02-02-direct-quotes.png', dst: 'Slide_02_Direkte_Zitate.png' },
  { src: 'social_content/batch-02/plain-batch-02-03-hard-data-only.png', dst: 'Slide_03_Harte_Daten.png' },
  { src: 'social_content/batch-02/plain-batch-02-04-no-speculation.png', dst: 'Slide_04_Keine_Spekulation.png' },
  { src: 'social_content/batch-02/plain-batch-02-05-no-narrative.png', dst: 'Slide_05_Kein_Narrativ.png' },
];

batch02Files.forEach(f => {
  if (fs.existsSync(f.src)) {
    fs.copyFileSync(f.src, path.join(targetRoot, '03_Carousel_Batch_02_Zero_Spin', f.dst));
    console.log('✓ Copied Slide:', f.dst);
  }
});

const batch02Caption = `======================================================================
INSTAGRAM / TIKTOK KARUSSELL BATCH 02: VERIFIZIERTE EREIGNISSE & HARTE DATEN
Slides in Reihenfolge 01 bis 05 hochladen
======================================================================

DEUTSCHER POST-TEXT:
Verifizierte Ereignisse, direkte Zitate und harte Daten.
Keine Spekulation. Keine geladenen Adjektive. Kein Narrativ.

Wenn du wissen willst, was wirklich passiert ist, ohne dass dir jemand sagt, wie du dich dabei fühlen sollst:
Besuche plain-news.ch

#news #klartext #fakten #nachrichten #schweiz #deutschland #medien #unabhängig #journalismus

----------------------------------------------------------------------
ENGLISH CAPTION:
Verified events, direct quotes, and hard data only.
No speculation. No loaded adjectives. No narrative.

If you want to understand reality without being told how to feel about it:
Visit plain-news.ch

#news #facts #data #truth #press #information #globalnews #switzerland
`;
fs.writeFileSync(path.join(targetRoot, '03_Carousel_Batch_02_Zero_Spin/POSTING_TEXT_BATCH_02.txt'), batch02Caption, 'utf8');

// 4. App Assets
if (fs.existsSync('C:/Users/Simon/Desktop/plain-app-icon-1024.png')) {
  fs.copyFileSync('C:/Users/Simon/Desktop/plain-app-icon-1024.png', path.join(targetRoot, '04_App_Assets/PLAIN_App_Icon_1024x1024.png'));
  console.log('✓ Copied App Icon');
}
if (fs.existsSync('C:/Users/Simon/Desktop/plain-tiktok-demo.mp4')) {
  fs.copyFileSync('C:/Users/Simon/Desktop/plain-tiktok-demo.mp4', path.join(targetRoot, '04_App_Assets/TikTok_Demo_Integration.mp4'));
  console.log('✓ Copied TikTok Demo');
}

// Master Overview Guide
const guide = `======================================================================
PLAIN. SOCIAL MEDIA CONTENT SAMMLUNG
Ordner: Desktop\\PLAIN_Social_Media_Content
======================================================================

Hier findest du alle fertigen Videos, Grafiken und vorbereiteten Texte,
um sie direkt und ohne nervige API-Hürden auf TikTok, Instagram und
Facebook hochzuladen!

ORDNER-STRUKTUR:

📁 01_Videos_and_Reels/
   • 01_PLAIN_Master_Ad_30s.mp4 -> Das 30-Sekunden Meister-Video (Apple/Swiss brutalist Style mit Audio & Voiceover).
   • 02_PLAIN_Brand_Promo.mp4   -> Vertikales Promo-Video.
   • 03_PLAIN_Platform_Tour.mp4 -> UI-Tour der Website.
   • VIDEO_POSTING_TEXTS.txt    -> Fertige Captions auf Deutsch & Englisch.

📁 02_Carousel_Batch_01_Die_5_Prinzipien/
   • 5 hochauflösende Slides (01-05) im 1080x1350 Instagram/TikTok Karussell-Format.
   • Thema: 0 Werbung, 0 Paywalls, 0 Trackers, Simon Eggert Zitat.
   • POSTING_TEXT_BATCH_01.txt -> Fertiger Text & Hashtags.

📁 03_Carousel_Batch_02_Zero_Spin/
   • 5 hochauflösende Slides (01-05).
   • Thema: Verifizierte Ereignisse, direkte Zitate, harte Daten, kein Narrativ.
   • POSTING_TEXT_BATCH_02.txt -> Fertiger Text & Hashtags.

📁 04_App_Assets/
   • PLAIN_App_Icon_1024x1024.png -> Offizielles quadratisches App-Icon.
   • TikTok_Demo_Integration.mp4  -> Demo-Video für Developer Portal Registrierungen.

EMPFOHLENER POSTING-ZEITPLAN (5-Stunden-Takt):
1. Jetzt: Video 01 (Master Ad 30s) auf TikTok & Instagram Reels
2. In 5 Stunden: Karussell Batch 01 (Die 5 Prinzipien)
3. In weiteren 5 Stunden: Karussell Batch 02 (Zero Spin & Harte Daten)
`;
fs.writeFileSync(path.join(targetRoot, 'ANLEITUNG_UND_POSTING_PLAN.txt'), guide, 'utf8');

console.log('\n=============================================================');
console.log('✓ All content batches organized on Desktop:');
console.log('  C:\\Users\\Simon\\Desktop\\PLAIN_Social_Media_Content');
console.log('=============================================================');
