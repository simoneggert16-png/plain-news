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
  // Charts, slide exports and the like are graphics, not photographs. A
  // picture of a diagram is not the face of the people in the story.
  /template/i,
  /graph(?:ic)?[-_]?(?:template|placeholder|export)/i,
  /metatag[-_]?image/i,
  /\.pptx/i,
  // Social cards are made for a timeline, not for the story.
  /[_/-]og(?:[%20\s_-])*card/i,
  /opengraph/i,
  /open[-_]graph/i,
  /social[-_]?card/i,
  /1200x628/i,
  /\bwidth=1200\b.*\bheight=628\b/i,
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
  // GIF: GIF87a, GIF89a
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
  if (ytMatch && ytMatch[1] && ytMatch[1] !== 'dQw4t9WgXcQ') {
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

// Parentheses in captions often hold a party name or a date, not a credit.
const PHOTO_CREDIT = /\b(photo|photograph|foto|bild|getty|reuters|ap|afp|dpa|epa|keystone|shutterstock|imago|anadolu|zuma|bloomberg|flash90|laif|picture alliance|agency)\b|\//i;

// A graphic is not a photograph. A logo, a chart, an illustration or a
// rendering cannot show the people in the story, so it never becomes the
// picture of the story - however good it looks.
const NOT_A_PHOTO = /\b(logos?|icons?|illustrations?|graphics?|charts?|diagrams?|infographics?|maps?|screenshots?|screen ?capture|collage|renderings?|computer[- ]generated|ai[- ]generated|artificially generated|3d[- ]render|animation|animated|stock photo|file photo)\b/i;

// A picture whose main subject is a sign, poster or notice board is not the
// picture of the story either - an "Ebola alert" poster with pictogram figures
// is a graphic that happens to be photographed. Only captions that make the
// sign the subject count; "protesters holding signs" is still a photo.
const SIGNAGE_SUBJECT = /\b(?:sign|signboard|poster|placard|billboard|notice board|leaflet|flyer)\b[^.!?]{0,40}\b(?:reads|reading|says|saying|shows|showing|displays|displaying|warns|warning)\b|\b(?:sign|signboard|poster|placard|billboard|notice board)\b\s*(?:\(|:)?\s*["'„“]/i;

/** True when the caption says the picture is a sign or poster, not a scene. */
export function isSignageCaption(caption) {
  return Boolean(caption) && SIGNAGE_SUBJECT.test(caption);
}

// Words that put a human being into the picture.
const PEOPLE = /\b(men|man|woman|women|people|child|children|boy|girl|family|father|mother|parents|resident|victim|victims|worker|workers|employee|employees|soldier|soldiers|officer|officers|official|officials|minister|president|leader|protester|protesters|miner|miners|refugee|refugees|citizen|citizens|patient|patients|student|students|fisherman|farmer|neighbour|customer|investor|trader|engineer|defendant|accused|suspect|arrested|charged|convicted|sentenced|hearing|trial|court|parliament|senator|congress|governor|mayor|chief|founder|director|banker|migrant|tourist)\b/i;

// Words that appear in almost every caption and therefore say nothing about
// the place the picture was taken.
const GENERIC_CAPTION_WORDS = new Set([
  'the', 'this', 'that', 'these', 'those', 'photo', 'image', 'picture', 'file',
  'reuters', 'afp', 'getty', 'epa', 'dpa', 'keystone', 'imago', 'bloomberg',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'source', 'credit', 'caption',
  'news', 'world', 'update', 'exclusive', 'analysis',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'his', 'her', 'their', 'its', 'our', 'his', 'and', 'but', 'for', 'with',
  'after', 'before', 'during', 'while', 'when', 'where', 'what', 'who', 'why',
  'how', 'from', 'into', 'over', 'under', 'above', 'below', 'between', 'among',
  'about', 'despite', 'following', 'since', 'until', 'upon', 'within',
  'without', 'near', 'next', 'last', 'first', 'second', 'third', 'both',
]);

/** Reads the content of a meta tag, whatever order the attributes are in. */
export function metaContent(html, names) {
  if (!html) return '';
  const wanted = names.map((n) => n.toLowerCase());
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = tag[0].match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i);
    if (!key || !wanted.includes(key[1].toLowerCase())) continue;
    const content = tag[0].match(/content\s*=\s*["']([^"']*)["']/i);
    if (!content) continue;
    const value = cleanCaptionText(content[1]);
    if (value) return value;
  }
  return '';
}

/**
 * Splits a caption into the sentence and the credit.
 *
 * Publishers put the credit in a nested element ("Image: Evan Vucci/AP Photo")
 * or behind a sign ("© Evan Vucci"). Both belong to the photographer, not to
 * the description of the picture.
 */
export function splitCaption(html) {
  if (!html) return { caption: '', credit: '' };

  let credit = '';
  let body = html;

  const nested = body.match(/<(small|span|p|div)\b[^>]*class=["'][^"']*(?:copyright|credit)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i);
  if (nested) {
    credit = cleanCaptionText(nested[2].replace(/<[^>]+>/g, ' '));
    body = body.replace(nested[0], ' ');
  }

  const caption = cleanCaptionText(body.replace(/<[^>]+>/g, ' '));

  if (!credit) {
    const paren = caption.match(/\((?:[^)]{0,24})?\b(photo(?:graph)?|foto|bild|image|credit|source|courtesy|news|©)\s*:\s*([^)]{3,60})\)/i);
    if (paren) {
      credit = cleanCaptionText(paren[2]);
      return { caption: cleanCaptionText(caption.replace(paren[0], '')), credit };
    }
    const trailing = caption.match(/\s*(?:©|\(c\)|copyright)\s*([^)]{4,80})\s*$/i);
    if (trailing) {
      credit = cleanCaptionText(trailing[1]);
      return { caption: cleanCaptionText(caption.replace(trailing[0], '')), credit };
    }
    const wire = caption.match(/\b((?:REUTERS|AFP|AP|GETTY IMAGES|EPA|DPA|KEYSTONE|BLOOMBERG|PICTURE ALLIANCE|IMAGO)\s*\/\s*[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2})\s*$/);
    if (wire) {
      credit = cleanCaptionText(wire[1]);
      return { caption: cleanCaptionText(caption.replace(wire[0], '')), credit };
    }
  }

  return { caption, credit };
}

/**
 * The caption of the picture inside this <figure>.
 *
 * A caption belongs to the picture next to it. Looking for the first caption
 * in the document instead hands us the caption of the next picture - a white
 * alpaca in a zoo, the secretary of a ministry.
 */
function figureCaption(html, position) {
  if (!Number.isFinite(position) || position < 0) return { caption: '', credit: '' };
  for (const m of html.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi)) {
    const start = m.index ?? -1;
    if (position < start || position >= start + m[0].length) continue;
    const fig = m[1].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
    if (!fig) return { caption: '', credit: '' };
    return splitCaption(fig[1]);
  }
  return { caption: '', credit: '' };
}

/**
 * The caption that belongs to the picture at this place in the page.
 *
 * A page carries many pictures: the lead photo, charts, and the sidebar of
 * related stories with a white alpaca in it. The caption of the first
 * <figcaption> in the document often describes another picture entirely, so
 * the caption has to be found next to the image - inside the same <figure>
 * or within a few hundred characters of it.
 */
function captionNear(html, position) {
  const scoped = figureCaption(html, position);
  if (scoped.caption) return scoped;

  if (!Number.isFinite(position) || position < 0) return { caption: '', credit: '' };

  let best = { caption: '', credit: '', distance: Infinity };
  for (const m of html.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi)) {
    const at = m.index ?? -1;
    const distance = Math.abs(at - position);
    if (distance > 1200) continue;
    const parts = splitCaption(m[1]);
    if (!parts.caption) continue;
    if (distance < best.distance) best = { ...parts, distance };
  }
  return { caption: best.caption, credit: best.credit };
}

/** The visible words of the page, used to check whether a caption fits. */
function pageWords(html) {
  return String(html || '')
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .toLowerCase();
}

/**
 * True when the caption does not name a place or person that the article
 * never mentions. The caption of a picture from another story names other
 * people, other cities, other animals.
 */
export function captionFitsPage(caption, html) {
  if (!caption) return false;
  return namedEntities(caption, html) > 0 || !caption.match(/\b[A-Z][a-zA-ZÀ-ÿ'’-]{2,}\b/g);
}

/** How many names of people and places the caption and the page share. */
function namedEntities(caption, html) {
  if (!caption) return 0;
  const words = caption.match(/\b[A-Z][a-zA-ZÀ-ÿ'’-]{2,}\b/g);
  if (!words) return 0;
  const haystack = pageWords(html);
  const named = new Set(
    words
      .filter((w) => !GENERIC_CAPTION_WORDS.has(w.toLowerCase()))
      .filter((w) => haystack.includes(w.toLowerCase()))
      .map((w) => w.toLowerCase())
  );
  return named.size;
}

/** True when the caption describes a photograph and not a graphic. */
export function isPhotograph(caption) {
  if (!caption) return false;
  return !NOT_A_PHOTO.test(caption) && !isSignageCaption(caption);
}

/** True when the caption puts a human being into the picture. */
export function mentionsPeople(caption) {
  if (!caption) return false;
  return PEOPLE.test(caption);
}

/** Two URLs that point at the same picture, only in different sizes. */
export function samePicture(a, b) {
  const key = (url) => String(url || '')
    .split(/[?#]/)[0]
    .split('/')
    .pop()
    ?.replace(/[_-]\d{1,4}\.(?:jpe?g|png|webp|avif)$/i, '')
    .replace(/\.(?:jpe?g|png|webp|avif)$/i, '')
    .toLowerCase();
  const ka = key(a);
  const kb = key(b);
  return Boolean(ka && kb && ka === kb);
}

/** The credit as it stands in the data the page ships with. */
function jsonCredit(html) {
  const fields = ['licenserSupplement', 'creditText', 'copyrightHolder', 'photographer'];
  for (const field of fields) {
    const match = html.match(new RegExp(`"${field}"\\s*:\\s*"([^"]{3,80})"`, 'i'));
    if (!match) continue;
    const value = cleanCaptionText(match[1]);
    if (value && PHOTO_CREDIT.test(value)) return value;
  }
  return '';
}

/** The biggest variant of a lazy-loaded picture. */
function largestVariant(srcset) {
  if (!srcset) return '';
  const variants = srcset.split(',').map((part) => {
    const [url, descriptor] = part.trim().split(/\s+/);
    const width = Number((descriptor || '').match(/(\d+)w$/)?.[1] || 0);
    return { url, width };
  }).filter((v) => v.url);
  if (!variants.length) return '';
  return variants.sort((a, b) => b.width - a.width)[0].url;
}

/** Score and select highest quality image, real caption, and video from source material. */
export function cleanImageUrl(url) {
  if (typeof url !== 'string') return url;
  return url.replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&');
}

export function extractImagesFromHtml(html) {
  if (!html) return [];
  const list = [];

  // OpenGraph image
  const og = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i);
  const ogUrl = og?.[1] || metaContent(html, ['og:image', 'og:image:secure_url']);

  // Twitter image
  const tw = html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i);
  const twUrl = tw?.[1] || metaContent(html, ['twitter:image', 'twitter:image:src']);

  // The social card carries the description of its own picture.
  const cardAlt = metaContent(html, ['og:image:alt', 'twitter:image:alt']);

  // Editorial article lead image. Publishers load it lazily and ship only the
  // variants, so the largest one has to be picked out of the srcset.
  const articleTag = html.match(/<article[\s\S]*?(<img\b[^>]*>)/i)?.[1] || '';
  const srcAttr = articleTag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || '';
  const srcsetAttr = articleTag.match(/\bsrcset=["']([^"']+)["']/i)?.[1] || '';
  const articleUrl = srcAttr ? cleanImageUrl(srcAttr) : cleanImageUrl(largestVariant(srcsetAttr));
  const articleAt = articleTag ? html.indexOf(articleTag) : -1;
  const titleText = articleTag.match(/\btitle=["']([^"']+)["']/i)?.[1];
  const altText = articleTag.match(/\balt=["']([^"']+)["']/i)?.[1];
  // The alt text of the picture describes the picture; the caption under it
  // is often an editor's note about the situation.
  const picture = splitCaption(`<span>${cleanCaptionText(titleText || altText || '')}</span>`);

  const near = captionNear(html, articleAt);
  const pageCredit = near.credit || picture.credit || jsonCredit(html);

  // The caption belongs to the picture in the article. The og:image is often
  // that same picture, but it can also be a logo, a diagram or a social card -
  // then the caption would be a lie.
  const ogIsTheArticle = Boolean(ogUrl && articleUrl && samePicture(ogUrl, articleUrl));
  const ogCaption = ogIsTheArticle ? (cardAlt || picture.caption || near.caption) : cardAlt;
  const ogCredit = ogIsTheArticle ? pageCredit : jsonCredit(html);

  if (ogUrl && !isJunkImage(ogUrl)) list.push({ url: ogUrl, score: 8, caption: ogCaption, credit: ogCredit });

  if (twUrl && !isJunkImage(twUrl)) list.push({ url: twUrl, score: 7, caption: ogCaption, credit: ogCredit });

  if (articleUrl && !isJunkImage(articleUrl)) {
    // Two descriptions of the same picture compete: the alt text of the image
    // and the caption under it. The one that names more of the people and
    // places in the story is the better caption.
    const altNames = namedEntities(picture.caption, html);
    const figNames = namedEntities(near.caption, html);
    const caption = figNames > altNames ? near.caption : (picture.caption || near.caption);
    list.push({ url: articleUrl, score: 9, caption, credit: pageCredit });
  }

  // A caption that names a place the article never mentions belongs to a
  // picture of another story.
  const title = metaContent(html, ['og:title']) || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const headline = cleanCaptionText(title).toLowerCase();
  return list
    .filter((candidate) => !candidate.caption || captionFitsPage(candidate.caption, html))
    .map((candidate) => {
      // The headline is not the caption of the picture.
      if (!candidate.caption || !headline) return candidate;
      const text = candidate.caption.toLowerCase();
      if (text === headline || (headline.length > 25 && text.includes(headline))) {
        return { ...candidate, caption: '' };
      }
      return candidate;
    });
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
      // The caption says the picture is a sign or a poster - that is a graphic
      // that happens to be photographed, not the face of the story.
      if (isSignageCaption(caption)) continue;
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
