import fs from 'node:fs';
import { isJunkImage, checkImageQuality } from './media.mjs';

if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const VISION_MODEL = process.env.NVIDIA_VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct';

// Blacklisted phrases that indicate bad AI generation, logo captions, or meta-disclaimers
const BANNED_CAPTION_PATTERNS = [
  /fox\s*news/i,
  /flash\s*headline/i,
  /breaking\s*headline/i,
  /news\s*studio/i,
  /studio\s*screenshot/i,
  /network\s*logo/i,
  /tv\s*graphic/i,
  /does\s*not\s*depict/i,
  /serves\s*as\s*a\s*visual\s*representation/i,
  /generic\s*illustration/i,
  /factual,\s*precise\s*caption/i,
  /sachliche,\s*pr[aä]zise\s*bildbeschreibung/i,
  /stock\s*photo/i,
];

function isDisqualifiedCaption(captionObj) {
  if (!captionObj) return true;
  const en = captionObj.en || '';
  const de = captionObj.de || '';
  return BANNED_CAPTION_PATTERNS.some(pat => pat.test(en) || pat.test(de));
}

/**
 * Multimodal AI Image Verifier & Caption Generator.
 * Powered by NVIDIA NIM Vision (meta/llama-3.2-11b-vision-instruct).
 * Enforces Swiss journalistic standards: authentic, high-res photojournalism only.
 */
export async function verifyAndCaptionImage(imageUrl, storyContext = {}) {
  if (!imageUrl || isJunkImage(imageUrl)) return null;

  // 1. Pre-flight technical quality check (resolution, aspect ratio)
  const quality = await checkImageQuality(imageUrl);
  if (!quality.ok) {
    console.log(`  VISION photo rejected by technical gate: ${quality.reason}`);
    return null;
  }

  const base64 = quality.buffer.toString('base64');
  const sourceCaption = storyContext.sourceCaption || '';
  const sourceCredit = storyContext.sourceCredit || '';

  const prompt = `You are the Senior Photo Editor for PLAIN, an unbiased global news wire.
Story Category: ${storyContext.category || 'news'}
Story Title: ${storyContext.title || ''}
Key Facts: ${(storyContext.facts || []).slice(0, 3).join('; ')}
Source Outlets: ${(storyContext.sources || []).map(s => s.outlet).join(', ')}
${sourceCaption ? `ORIGINAL PHOTOJOURNALIST CAPTION FROM WIRE (GROUND TRUTH): "${sourceCaption}"` : ''}
${sourceCredit ? `ORIGINAL PHOTO CREDIT: "${sourceCredit}"` : ''}

Examine this image carefully:
CRITICAL ACCURACY & IDENTITY RULES:
1. DO NOT ASSUME the person in the image is the person named in the article headline! News articles frequently illustrate stories with opposition politicians, supporters, voters, or spokespersons (e.g. an article about Friedrich Merz reacting to election gains may be illustrated with a photo of AfD politician Ulrich Siegmund).
2. If an ORIGINAL PHOTOJOURNALIST CAPTION is provided above, you MUST treat it as authoritative ground truth regarding WHO is depicted. Translate and adapt that caption cleanly into German and English.
3. If no wire caption is available and you are not 100% certain of an individual's name, describe what is visibly happening (e.g. "AfD-Politiker auf einer Wahlbühne", "Abgeordnete im Plenarsaal", "Demonstranten vor dem Regierungsgebäude"). NEVER hallucinate or guess a politician's name from the headline!
4. Automatic rejection: reject TV studio screenshots, news anchor talking heads, lower-third graphics, stock illustrations, or blurred logos.

If verified is true, write a calm, factual caption in German and English accurately describing what is depicted.
Determine image credit (e.g. ${sourceCredit || 'Reuters / AP / AFP'}).

Return ONLY valid raw JSON:
{
  "verified": true, // or false
  "rejectionReason": "brief reason if false",
  "caption": {
    "de": "Sachliche, wahrheitsgetreue Bildbeschreibung auf Deutsch",
    "en": "Factual, accurate caption in English"
  },
  "credit": "${sourceCredit || 'Reuters / AP'}"
}`;

  // 2. NVIDIA NIM Vision (primary — no Ollama, NVIDIA-only pipeline)
  if (process.env.NVIDIA_API_KEY) {
    try {
      const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 350,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (res.ok) {
        const json = await res.json();
        const raw = json.choices?.[0]?.message?.content || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.verified === false) {
            console.log(`  VISION Fallback model rejected image: ${parsed.rejectionReason || 'Not verified'}`);
            return null;
          }
          if (parsed.verified === true && parsed.caption) {
            if (isDisqualifiedCaption(parsed.caption)) {
              console.log(`  VISION Fallback caption contained disqualified phrases, rejecting image.`);
              return null;
            }
            return {
              verified: true,
              caption: parsed.caption,
              credit: parsed.credit || storyContext.sources?.[0]?.outlet || null,
            };
          }
        }
      }
    } catch (e) {
      console.warn('  VISION Fallback vision check failed:', e.message);
    }
  }

  return null;
}

