// Picks and places photos for long reads and investigations.
//
// The newsroom already curates a hero image per short report. Long reads used
// to run without any picture at all, so this module reuses the same source
// images, checks them with the wire-standard quality gate, and spreads the
// accepted ones across the sections of the piece.

import { checkImageQuality, cleanCaptionText, cleanImageUrl, isJunkImage } from './media.mjs';

const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Alt text and teases often repeat the headline. A caption that only restates
 * the title is worse than no caption, so those are dropped.
 */
function usableCaption(source, titles = []) {
  const caption = cleanCaptionText(source?.imageCaption || source?.caption);
  if (caption.length < 12) return '';
  // Question headlines and "what we know" teases are alt text, not captions.
  if (/\?\s*$/.test(caption) || /\b(here'?s why|what we know|live updates?|as it happened|explained)\b/i.test(caption)) return '';
  const text = normalizeText(caption);
  const allTitles = [normalizeText(source?.title), ...titles].filter(Boolean);
  if (allTitles.some((title) => text.length <= title.length * 1.15 && (text === title || text.includes(title) || title.includes(text)))) {
    return '';
  }
  return caption.slice(0, 300);
}

async function pool(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

/**
 * Validated, de-duplicated photos from the source pack. The first entry is the
 * hero; the rest are inline candidates. Prefers captioned images from distinct
 * outlets, because an uncaptioned photo we cannot credit is not publishable.
 */
const CREDIT_IN_CAPTION = /((?:REUTERS|AP|AFP|GETTY IMAGES|EPA|DPA|KEYSTONE|BLOOMBERG)\s*\/\s*[^,.;]{2,40})/i;

/** Wire copy carries the photographer inside the caption; pull it out. */
function splitCredit(caption, credit) {
  if (!caption) return { caption, credit };
  const match = caption.match(CREDIT_IN_CAPTION);
  if (!match) return { caption, credit };
  return {
    caption: caption.replace(CREDIT_IN_CAPTION, '').replace(/\s{2,}/g, ' ').replace(/[,;]\s*$/, '').trim(),
    credit: credit || match[1].replace(/\s+/g, ' ').trim(),
  };
}

export async function collectImages(sources, { max = 3, checks = 10 } = {}) {
  const candidates = [];
  const seen = new Set();
  const titles = (sources || []).map((source) => normalizeText(source?.title)).filter(Boolean);
  for (const source of sources || []) {
    const url = cleanImageUrl(source?.image);
    if (!url || seen.has(url) || isJunkImage(url)) continue;
    seen.add(url);
    const parts = splitCredit(
      usableCaption(source, titles),
      cleanCaptionText(source.imageCredit || source.credit).slice(0, 120)
    );
    candidates.push({ url, caption: parts.caption, credit: parts.credit, outlet: source.outlet || '' });
  }
  if (!candidates.length) return [];

  const accepted = [];
  await pool(candidates.slice(0, checks), 4, async (candidate) => {
    const quality = await checkImageQuality(candidate.url).catch(() => ({ ok: false }));
    if (quality.ok) accepted.push({ ...candidate, width: quality.dims?.width || 0 });
  });

  accepted.sort((a, b) => (b.caption ? 1 : 0) - (a.caption ? 1 : 0) || b.width - a.width);

  const chosen = [];
  const outlets = new Set();
  for (const image of accepted) {
    if (chosen.length >= max) break;
    if (image.outlet && outlets.has(image.outlet)) continue;
    outlets.add(image.outlet);
    chosen.push(image);
  }
  for (const image of accepted) {
    if (chosen.length >= max) break;
    if (!chosen.includes(image)) chosen.push(image);
  }
  return chosen;
}

/** Puts the remaining photos after the first paragraph of evenly spaced sections. */
export function assignImages(sections, images) {
  if (!Array.isArray(sections) || !sections.length) return sections;
  const inline = images.slice(1);
  if (!inline.length) return sections;

  const used = new Set();
  const targets = inline.map((_, i) => {
    let index = Math.floor(((i + 1) * sections.length) / (inline.length + 1));
    while (used.has(index) && index < sections.length - 1) index++;
    used.add(index);
    return index;
  });

  const bySection = new Map(targets.map((target, i) => [target, inline[i]]));
  return sections.map((section, index) => {
    const image = bySection.get(index);
    if (!image) return section;
    return {
      ...section,
      image: { url: image.url, caption: image.caption || '', credit: image.credit || '' },
    };
  });
}
