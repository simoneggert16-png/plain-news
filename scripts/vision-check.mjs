// Diagnose the image pipeline in CI: run the vision verifier on a handful of
// real wire photos and print what every provider actually answered.
//   node scripts/vision-check.mjs [url ...]
import { verifyAndCaptionImage } from '../bots/lib/vision.mjs';

const DEFAULT_URLS = [
  'https://www.goodnewsnetwork.org/wp-content/uploads/2026/10/Irrawaddy-dolphin-CC.jpg',
  'https://npr.brightspotcdn.com/dims3/default/strip/false/crop/8640x5760+0+0/resize/1440/format/jpeg/',
  'https://www.aljazeera.com/wp-content/uploads/2026/10/reuters_6adf7e22-179303171',
];

const urls = process.argv.slice(2).filter(Boolean);
for (const url of urls.length ? urls : DEFAULT_URLS) {
  const started = Date.now();
  const result = await verifyAndCaptionImage(url, {
    category: 'world',
    title: 'Test story for the vision pipeline',
    facts: ['A test fact'],
    sources: [{ outlet: 'Test Wire' }],
    sourceCaption: '',
    sourceCredit: 'Reuters',
  }).catch((e) => ({ verified: null, unavailable: true, reason: `threw: ${e.message}` }));
  console.log(
    JSON.stringify({
      url: url.slice(0, 80),
      ms: Date.now() - started,
      verified: result?.verified ?? null,
      unavailable: result?.unavailable || false,
      reason: result?.rejectionReason || result?.reason || null,
      caption: result?.caption?.en || null,
      credit: result?.credit || null,
    })
  );
}
