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
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';
const VISION_MODEL = process.env.NVIDIA_VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct';
// The vision model is slow (10-40s per image) and the newsroom has a budget.
// A missing verdict is not fatal any more: the photo is kept with the wire's
// own caption, so waiting longer only costs time.
const VISION_TIMEOUT_MS = Math.max(5000, Number(process.env.VISION_TIMEOUT_MS) || 20000);

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

// Reasons that mean "this is not usable photojournalism" - the only kind of
// rejection that is allowed to throw the picture away. Everything else (an
// unsure model, "identity not 100% certain", a timeout) keeps the image with
// the original wire caption instead.
const HARD_REJECT_PATTERNS =
  /(screenshot|screen\s*capture|studio|anchor|talking\s*head|tv\s*graphic|lower[- ]third|logo|watermark|illustration|stock\s*(?:photo|image)|placeholder|banner|thumbnail|headshot|cartoon|diagram|no\s*image|not\s*an?\s*(?:photo|image)|poster|placard|signboard|billboard|notice\s*board|leaflet|flyer)/i;

function isDisqualifiedCaption(captionObj) {
  if (!captionObj) return true;
  const en = captionObj.en || '';
  const de = captionObj.de || '';
  return BANNED_CAPTION_PATTERNS.some((pat) => pat.test(en) || pat.test(de));
}

function sniffMime(buf) {
  if (buf?.[0] === 0xff && buf?.[1] === 0xd8) return 'image/jpeg';
  if (buf?.[0] === 0x89 && buf?.[1] === 0x50) return 'image/png';
  if (buf?.[0] === 0x47 && buf?.[1] === 0x49) return 'image/gif';
  if (buf?.[0] === 0x52 && buf?.[1] === 0x49) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Vision models on NIM often ignore the JSON contract and answer in prose
 * ("**Verification Status:** False"). Parse both.
 */
function parseVisionAnswer(raw = '') {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      /* truncated JSON - fall back to prose */
    }
  }
  const verdict = raw.match(
    /(?:verified|verification(?:\s*status)?|accurate|usable|passes)\W{0,10}(true|false|yes|no|pass|fail)/i
  );
  if (!verdict) return null;
  const ok = /true|yes|pass/i.test(verdict[1]);
  return {
    verified: ok,
    rejectionReason: ok ? '' : raw.replace(/\s+/g, ' ').trim().slice(0, 160),
  };
}

/**
 * Turn a model answer into a verifier result:
 *   true      -> use the AI caption
 *   false     -> editorial rejection, drop the image
 *   null      -> no usable verdict, keep the image with its wire caption
 */
function interpret(parsed, storyContext, sourceLabel) {
  if (!parsed) {
    console.log(`  VISION ${sourceLabel}: no usable answer.`);
    return { verified: null, unavailable: true, reason: `${sourceLabel} unparseable answer` };
  }
  if (parsed.verified === true) {
    if (!parsed.caption) {
      return { verified: null, unavailable: false, reason: `${sourceLabel} confirmed image but wrote no caption` };
    }
    if (isDisqualifiedCaption(parsed.caption)) {
      console.log(`  VISION ${sourceLabel} caption contained disqualified phrases; keeping image without AI caption.`);
      return { verified: null, unavailable: false, reason: `${sourceLabel} caption disqualified` };
    }
    return {
      verified: true,
      caption: parsed.caption,
      credit: parsed.credit || storyContext.sources?.[0]?.outlet || null,
    };
  }
  const reason = parsed.rejectionReason || 'not verified';
  if (HARD_REJECT_PATTERNS.test(reason)) {
    console.log(`  VISION ${sourceLabel} rejected image: ${reason}`);
    return { verified: false, rejectionReason: reason };
  }
  console.log(`  VISION ${sourceLabel} was not convinced (${reason.slice(0, 90)}); keeping image with wire caption.`);
  return { verified: null, unavailable: false, reason: `${sourceLabel}: ${reason}` };
}

/**
 * Multimodal AI Image Verifier & Caption Generator.
 *
 * Return contract:
 *   { verified: true, caption, credit }   -> approved, use the AI caption
 *   { verified: false, rejectionReason }  -> unusable photo, drop it
 *   { verified: null, ... }               -> no usable verdict, keep the photo
 *   null                                  -> failed the technical gate
 *
 * The null-verdict state used to be indistinguishable from a rejection, so
 * every API hiccup silently threw away ~95% of all article photos.
 */
export async function verifyAndCaptionImage(imageUrl, storyContext = {}) {
  if (!imageUrl || isJunkImage(imageUrl)) return null;

  // 1. Pre-flight technical quality check (resolution, aspect ratio)
  const quality = await checkImageQuality(imageUrl);
  if (!quality.ok) {
    console.log(`  VISION photo rejected by technical gate: ${quality.reason}`);
    return null;
  }

  const dataUrl = `data:${sniffMime(quality.buffer)};base64,${quality.buffer.toString('base64')}`;
  const sourceCaption = storyContext.sourceCaption || '';
  const sourceCredit = storyContext.sourceCredit || '';
  let unavailable = null;

  const prompt = `You are the Senior Photo Editor for PLAIN, an unbiased global news wire.
Story Category: ${storyContext.category || 'news'}
Story Title: ${storyContext.title || ''}
Key Facts: ${(storyContext.facts || []).slice(0, 3).join('; ')}
Source Outlets: ${(storyContext.sources || []).map((s) => s.outlet).join(', ')}
${sourceCaption ? `ORIGINAL PHOTOJOURNALIST CAPTION FROM WIRE (GROUND TRUTH): "${sourceCaption}"` : ''}
${sourceCredit ? `ORIGINAL PHOTO CREDIT: "${sourceCredit}"` : ''}

Examine this image carefully:
CRITICAL ACCURACY & IDENTITY RULES:
1. DO NOT ASSUME the person in the image is the person named in the article headline! News articles frequently illustrate stories with opposition politicians, supporters, voters, or spokespersons (e.g. an article about Friedrich Merz reacting to election gains may be illustrated with a photo of AfD politician Ulrich Siegmund).
2. If an ORIGINAL PHOTOJOURNALIST CAPTION is provided above, you MUST treat it as authoritative ground truth regarding WHO is depicted. Translate and adapt that caption cleanly into German and English.
3. If no wire caption is available and you are not 100% certain of an individual's name, describe what is visibly happening (e.g. "AfD-Politiker auf einer Wahlbühne", "Abgeordnete im Plenarsaal", "Demonstranten vor dem Regierungsgebäude"). NEVER hallucinate or guess a politician's name from the headline!
4. Automatic rejection: reject TV studio screenshots, news anchor talking heads, lower-third graphics, stock illustrations, or blurred logos.
5. Automatic rejection: if the main subject of the picture is a sign, poster, placard or notice board (for example an "Ebola alert" poster with pictogram figures), reject it and name the reason "poster/sign". A reader wants to see the people, the place or the action - not a board that hangs in the scene. A photo of people holding signs at a protest is not that: it stays.

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

  // 2. Ollama (primary while the subscription lasts; skips itself on 401/402)
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
          messages: [
            {
              role: 'user',
              content: prompt,
              images: [quality.buffer.toString('base64')],
            },
          ],
          options: { temperature: 0.1 },
          stream: false,
        }),
        signal: AbortSignal.timeout(Math.max(VISION_TIMEOUT_MS, 45000)),
      });

      if (res.ok) {
        const json = await res.json();
        const raw = json.message?.content || json.message?.thinking || '';
        if (process.env.VISION_DEBUG) console.log(`  VISION ollama raw: ${raw.slice(0, 800)}`);
        const result = interpret(parseVisionAnswer(raw), storyContext, 'MiniMax M3');
        if (result.verified !== null) return result;
        unavailable = result.reason;
      } else {
        unavailable = `ollama HTTP ${res.status}`;
      }
    } catch (e) {
      console.warn('  VISION MiniMax M3 error, trying NVIDIA fallback:', e.message);
      unavailable = `ollama ${e.message}`;
    }
  }

  // 3. NVIDIA NIM Vision (permanent fallback)
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
                { type: 'image_url', image_url: { url: process.env.VISION_IMAGE_MODE === 'url' ? imageUrl : dataUrl } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
      });

      if (res.ok) {
        const json = await res.json();
        const raw = json.choices?.[0]?.message?.content || '';
        if (process.env.VISION_DEBUG) console.log(`  VISION nvidia raw: ${raw.slice(0, 900)}`);
        const result = interpret(parseVisionAnswer(raw), storyContext, 'NVIDIA');
        if (result.verified !== null) return result;
        unavailable = result.reason;
      } else {
        unavailable = `nvidia HTTP ${res.status}`;
      }
    } catch (e) {
      console.warn('  VISION NVIDIA check failed:', e.message);
      unavailable = `nvidia ${e.message}`;
    }
  }

  console.log(`  VISION no verdict (${unavailable || 'no provider configured'}).`);
  return { verified: null, unavailable: true, reason: unavailable || 'no vision provider configured' };
}
