import { isJunkImage } from './media.mjs';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

/**
 * Multimodal AI Image Verifier & Caption Generator.
 * Powered primarily by MiniMax M3 (multimodal visual analysis) on Ollama Cloud,
 * with fallback to Llama 3.2 Vision on NVIDIA.
 */
export async function verifyAndCaptionImage(imageUrl, storyContext = {}) {
  if (!imageUrl || isJunkImage(imageUrl)) return null;

  const prompt = `You are a Senior Photo Editor for PLAIN., an unbiased, fact-only global news wire.
Story Category: ${storyContext.category || 'news'}
Story Title: ${storyContext.title || ''}
Key Facts: ${(storyContext.facts || []).slice(0, 3).join('; ')}
Source Outlets: ${(storyContext.sources || []).map(s => s.outlet).join(', ')}

Examine this image carefully:
1. Double check authenticity & relevance: Does this image appropriately and factually illustrate this real-world event without being misleading, generic clipart, or an unrelated meme?
2. Generate an accurate, journalistic image caption (Bildbeschreibung) in German and English. State who or what is depicted calmly and objectively. Do NOT speculate.
3. Determine image credit (e.g. from known outlet or news agency like dpa, AFP, Reuters, AP, Getty).

Return ONLY valid raw JSON:
{
  "verified": true,
  "caption": {
    "de": "Sachliche, präzise Bildbeschreibung auf Deutsch",
    "en": "Factual, precise caption in English"
  },
  "credit": "MDR / dpa"
}`;

  // 1. Try MiniMax M3 on Ollama Cloud
  if (process.env.OLLAMA_API_KEY) {
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buf).toString('base64');
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
            if (parsed.verified && parsed.caption) {
              return {
                verified: true,
                caption: parsed.caption,
                credit: parsed.credit || storyContext.sources?.[0]?.outlet || null,
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn('MiniMax M3 vision check failed, falling back:', e.message);
    }
  }

  // 2. Fallback to NVIDIA Vision
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
          if (parsed.verified && parsed.caption) {
            return {
              verified: true,
              caption: parsed.caption,
              credit: parsed.credit || storyContext.sources?.[0]?.outlet || null,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Nvidia vision check failed:', e.message);
    }
  }

  return null;
}
