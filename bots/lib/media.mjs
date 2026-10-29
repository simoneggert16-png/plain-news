// PLAIN. Media Intelligence & Curator
// Strict editorial standards: authentic high-res photojournalism only.
// Filters out logos, TV banners, thumbnails, studio headshots, and stock slop.

export const JUNK_PATTERNS = [
  /politico-billboard/i,
  /billboard/i,
  /site[_-]?logo/i,
  /header[_-]?logo/i,
  /default[_-]?share/i,
  /placeholder/i,
  /fallback/i,
  /favicon/i,
  /apple-touch-icon/i,
  /blank\.(?:gif|png|jpe?g)/i,
  /avatar/i,
  /author/i,
  /headshot/i,
  /bio[-_]?pic/i,
  /staff/i,
  /profile/i,
  /share[_-]?icon/i,
  /logo[-_.]?(?:png|svg|jpg)/i,
  /og[-_]default/i,
  /meta[-_]default/i,
  /vgwort\.de/i,
  /blurple/i,
  /tracking/i,
  /pixel/i,
  /writer/i,
  /columnist/i,
  /bylines?/i,
  /foxnews.*(?:boltdns|match|flash|headline)/i,
  /boltdns\.net/i,
  /(?:flash|breaking)[_-]?headline/i,
  /(?:video[_-]?thumb|preview[_-]?thumb|default[_-]?thumb|lead[_-]?thumb)/i,
  /\b(?:100x100|150x150|200x200|300x200|337x225|sq-[a-f0-9]+)\b/i,
  /[?&]s=100\b/i,
  /ci102l/i,
  /w[=_:]?(?:100|150|200|300|337|400)\b/i,
  /badge|watermark|banner|ticker/i,
  /broadcast.*capture|capture-\d+/i,
  /\b(?:340\/340|150\/150|100\/100|80\/80|64\/64|150x150|200x200|300x200|w[=_:]150|w[=_:]200|w[=_:]300|thumb|thumbnail)\b/i,
];

export function isJunkImage(url) {
  if (!url || typeof url !== 'string') return true;
  if (!/^https?:\/\//i.test(url)) return true;
  return JUNK_PATTERNS.some((pat) => pat.test(url));
}

/** Pure Node.js zero-dependency image dimension parser from buffer header */
export function getImageDimensions(buffer) {
  if (!buffer || buffer.length < 16) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), type: 'png' };
  }
  // GIF: GIF87a or GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8), type: 'gif' };
  }
  // JPEG: FF D8
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xFF) { offset++; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, type: 'jpeg' };
      }
      const len = buffer.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }
  // WEBP: RIFF .... WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const vp8 = buffer.toString('ascii', 12, 16);
    if (vp8 === 'VP8X' && buffer.length >= 30) {
      return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3), type: 'webp' };
    }
    if (vp8 === 'VP8 ' && buffer.length >= 30) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff, type: 'webp' };
    }
    if (vp8 === 'VP8L' && buffer.length >= 25) {
      const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
      return { width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + ((((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))), type: 'webp' };
    }
  }
  return null;
}

/** Check image resolution and aspect ratio against Swiss editorial wire standards */
export async function checkImageQuality(imageUrl) {
  if (isJunkImage(imageUrl)) return { ok: false, reason: 'URL matches junk pattern' };
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const dims = getImageDimensions(buf);
    if (!dims) return { ok: false, reason: 'Unable to parse image dimensions' };
    
    // Strict wire standards: minimum 640x360
    if (dims.width < 640 || dims.height < 360) {
      return { ok: false, reason: `Resolution too low: ${dims.width}x${dims.height} < 640x360`, dims, buffer: buf };
    }

    // Aspect ratio check: must be reasonable landscape (1.15 to 2.4)
    const ratio = dims.width / dims.height;
    if (ratio < 1.15 || ratio > 2.4) {
      return { ok: false, reason: `Unacceptable aspect ratio: ${ratio.toFixed(2)} (requires 1.15-2.4)`, dims, buffer: buf };
    }

    return { ok: true, dims, buffer: buf };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export function extractVideoFromHtml(html) {
  if (!html) return null;

  // 1. YouTube embeds or links
  const ytMatch = html.match(/(?:youtube\.com\/(?:embed\/|v\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1] && ytMatch[1] !== 'dQw4w9WgXcQ') {
    return {
      type: 'youtube',
      id: ytMatch[1],
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
    };
  }

  // 2. Direct HTML5 video source
  const videoTagMatch = html.match(/<video[^>]*>[\s\S]*?<source[^>]+src=["']([^"']+\.mp4(?:\?[^"']*)?)["']/i) ||
                        html.match(/<video[^>]+src=["']([^"']+\.mp4(?:\?[^"']*)?)["']/i);
  if (videoTagMatch && videoTagMatch[1] && /^https?:\/\//i.test(videoTagMatch[1])) {
    return {
      type: 'video',
      url: videoTagMatch[1],
    };
  }

  return null;
}

/** Decode entities and strip the CMS prefixes that ship inside figcaptions. */
export function cleanCaptionText(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(+dec))
    .replace(/&(amp|quot|lt|gt|nbsp|apos);/gi, (m) => ({ '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&apos;': "'" }[m.toLowerCase()] ?? m))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^figure caption[:\s,-]*/i, '')
    .replace(/^(?:caption|bild(?:unterschrift)?|photo|photograph|image|credit|source|courtesy)[:\s,-]+/i, '')
    .trim();
}

export function extractImagesFromHtml(html) {
  if (!html) return [];
  const list = [];

  // Extract primary figcaption if present in the document
  const fig = html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
  let pageCaption = '';
  let pageCredit = '';
  if (fig && fig[1]) {
    const raw = cleanCaptionText(fig[1].replace(/<[^>]+>/g, ' '));
    const creditMatch = raw.match(/\[(?:File:?\s*)?([^\]]+)\]|\((?:Photo(?:\s+by)?:\s*)?([^\)]+)\)/i);
    // Parentheses in captions often hold a party name or a date, not a credit.
    const PHOTO_CREDIT = /\b(photo|photograph|foto|bild|getty|reuters|ap|afp|dpa|epa|keystone|shutterstock|imago|anadolu|zuma|bloomberg|flash90|laif|picture alliance|agency)\b|\//i;
    if (creditMatch) {
      const candidate = cleanCaptionText(creditMatch[1] || creditMatch[2]);
      if (candidate && PHOTO_CREDIT.test(candidate)) pageCredit = candidate;
    }
    pageCaption = raw.replace(/\[[^\]]+\]|\([^\)]+\)/g, '').trim();
  }

  // OpenGraph image
  const og = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i);
  if (og && og[1] && !isJunkImage(og[1])) list.push({ url: og[1], score: 8, caption: pageCaption, credit: pageCredit });

  // Twitter image
  const tw = html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i);
  if (tw && tw[1] && !isJunkImage(tw[1])) list.push({ url: tw[1], score: 7, caption: pageCaption, credit: pageCredit });

  // Editorial article lead image
  const articleImg = html.match(/<article[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (articleImg && articleImg[1] && !isJunkImage(articleImg[1])) {
    const altMatch = articleImg[0].match(/alt=["']([^"']+)["']/i);
    const altText = altMatch ? cleanCaptionText(altMatch[1]) : '';
    list.push({ url: articleImg[1], score: 9, caption: pageCaption || altText, credit: pageCredit });
  }

  return list;
}

/** Score and select highest quality image, real caption, and video from source material. */
export function cleanImageUrl(url) {
  if (typeof url !== 'string') return url;
  return url.replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&');
}

export function curateMedia(sources = []) {
  let bestImage = null;
  let bestCaption = null;
  let bestCredit = null;
  let bestVideo = null;
  let highestScore = -1;

  for (const s of sources) {
    if (!bestVideo && s.video) {
      bestVideo = s.video;
    }

    const imageUrl = cleanImageUrl(s.image);
    if (imageUrl && !isJunkImage(imageUrl)) {
      const caption = cleanCaptionText(s.imageCaption || s.caption);
      const credit = cleanCaptionText(s.imageCredit || s.credit);
      let score = 5;
      if (/aljazeera|spiegel|nytimes|reuters|apnews|gettyimages|afp|tagesschau/i.test(imageUrl)) score += 5;
      if (/1920|1440|1080|1200/i.test(imageUrl)) score += 3;
      if (caption) score += 4; // Prioritize images with verified photographer captions!
      if (score > highestScore) {
        highestScore = score;
        bestImage = imageUrl;
        bestCaption = caption || null;
        bestCredit = credit || null;
      }
    }
  }

  return {
    image: bestImage,
    caption: bestCaption,
    credit: bestCredit,
    video: bestVideo,
  };
}

