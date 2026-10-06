import { extractImagesFromHtml, extractVideoFromHtml, isJunkImage } from './media.mjs';

const BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct';

/**
 * Multimodal AI Image Verifier & Caption Generator.
 * Double-checks image relevance against story facts and generates
 * neutral editorial captions with photographer/outlet attribution.
 */
export async function verifyAndCaptionImage(imageUrl, storyContext = {}) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key || !imageUrl) return null;

  const prompt = `You are a Senior Photo Editor for PLAIN., a neutral, fact-only global news wire.
Story Category: ${storyContext.category || 'news'}
Story Title: ${storyContext.title || ''}
Key Facts: ${(storyContext.facts || []).slice(0, 3).join('; ')}
Source Outlets: ${(storyContext.sources || []).map(s => s.outlet).join(', ')}

Examine this image carefully:
1. Double check authenticity & relevance: Does this image appropriately and factually illustrate this real-world event without being misleading, generic clipart, or an unrelated meme?
2. Generate an accurate, journalistic image caption (Bildbeschreibung) in German and English. State who or what is depicted calmly and objectively. Do NOT speculate.
3. Determine image credit (e.g. from known outlet or news agency like dpa, AFP, Reuters, AP).

Return ONLY valid JSON:
{
  "verified": true,
  "confidence": 0.95,
  "caption": {
    "de": "Sachliche, präzise Bildbeschreibung auf Deutsch",
    "en": "Factual, precise caption in English"
  },
  "credit": "MDR / dpa"
}`;

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
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
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.warn(`Vision check HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (parsed.verified) {
      return {
        verified: true,
        caption: parsed.caption,
        credit: parsed.credit || (storyContext.sources?.[0]?.outlet ?? 'Archiv'),
        verifier: VISION_MODEL,
      };
    }
    return null;
  } catch (err) {
    console.warn(`Vision verify error: ${err.message}`);
    return null;
  }
}
