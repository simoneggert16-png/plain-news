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

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

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
 * Powered primarily by MiniMax M3 (multimodal visual analysis) on Ollama Cloud.
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

  const prompt = `You are the Senior Photo Editor for PLAIN, an unbiased global news wire.
Story Category: ${storyContext.category || 'news'}
Story Title: ${storyContext.title || ''}
Key Facts: ${(storyContext.facts || []).slice(0, 3).join('; ')}
Source Outlets: ${(storyContext.sources || []).map(s => s.outlet).join(', ')}

Examine this image carefully:
AUTOMATIC REJECTION RULES (You MUST set "verified": false):
1. TV news studio set, newsroom desk, or broadcast graphic (e.g. Fox News Flash Headlines, CNN alert, broadcast overlay, lower-third graphic).
2. TV news anchor headshot, talking head, or generic microphone cluster.
3. Logo graphic, network watermark, stock illustration, 3D icon, or chart.
4. The image does NOT directly depict the primary real-world actors, physical event, or location described in the headline.
5. Low quality, blurry, or generic stock photo.

ACCEPTANCE RULES (You MUST set "verified": true):
1. Real editorial photojournalism directly capturing the actual physical subject, people, or event described in the headline.
2. Professional clarity and composition.

If verified is true, write a calm, factual caption in German and English describing what is visually depicted. Do NOT write disclaimers like "does not depict" or meta-commentary.
Determine image credit (e.g. Reuters, AP, AFP, dpa, Getty Images).

Return ONLY valid raw JSON:
{
  "verified": true, // or false
  "rejectionReason": "brief reason if false",
  "caption": {
    "de": "Sachliche Bildbeschreibung auf Deutsch",
    "en": "Factual caption in English"
  },
  "credit": "Reuters / AP"
}`;

  // 2. MiniMax M3 Multimodal Vision on Ollama Cloud
  if (process.env.OLLAMA_API_KEY) {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'minimax-m3',
          messages: [{
            role: 'user',
            content: prompt,
            images: [base64],
          }],
          options: { temperature: 0.1 },
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const json = await res.json();
        const raw = json.message?.content || json.message?.thinking || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.verified === false) {
            console.log(`  VISION MiniMax M3 rejected image: ${parsed.rejectionReason || 'Not verified'}`);
            // Strict gate: if MiniMax M3 actively rejects, do NOT fall back to other models!
            return null;
          }
          if (parsed.verified === true && parsed.caption) {
            if (isDisqualifiedCaption(parsed.caption)) {
              console.log(`  VISION MiniMax M3 caption contained disqualified phrases, rejecting image.`);
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
      console.warn('  VISION MiniMax M3 vision check encountered error, trying fallback:', e.message);
    }
  }

  // 3. Fallback to NVIDIA Vision ONLY on network/service failure
  if (process.env.NVIDIA_API_KEY) {
    try {
      const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta/llama-3.2-11b-vision-instruct',
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

