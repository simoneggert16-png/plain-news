// Picks and places photos for long reads and investigations.
//
// The newsroom already curates a hero image per short report. Long reads used
// to run without any picture at all, so this module reuses the same source
// images, checks them with the wire-standard quality gate, and spreads the
// accepted ones across the sections of the piece.

import { checkImageQuality, cleanCaptionText, cleanImageUrl, isJunkImage, isPhotograph, mentionsPeople } from './media.mjs';

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
 * hero; the rest are inline candidates.
 *
 * A picture without a caption is not publishable: nobody can say what it
 * shows, and nobody can be credited for it. Among the rest, the picture of
 * people wins over the picture of a logo, and the picture that talks about
 * the subject of the story wins over the one of a neighbouring story.
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

const FILLER_WORDS = new Set([
  'about', 'after', 'again', 'against', 'because', 'before', 'being', 'between',
  'could', 'would', 'their', 'there', 'these', 'those', 'under', 'while', 'which',
  'where', 'whose', 'other', 'into', 'than', 'then', 'they', 'them', 'what',
  'when', 'with', 'from', 'have', 'been', 'were', 'said', 'says', 'also', 'more',
  'most', 'over', 'such', 'only', 'just', 'like', 'make', 'made', 'many', 'much',
  'after', 'before', 'story', 'stories', 'report', 'reports', 'world', 'years',
]);

/** The words the piece is about. A caption that carries them belongs to it. */
function storyTerms(terms) {
  return [...new Set((terms || [])
    .flatMap((term) => normalizeText(term).split(' '))
    .filter((word) => word.length >= 5 && !FILLER_WORDS.has(word)))];
}

function termOverlap(caption, terms) {
  const text = normalizeText(caption);
  return terms.filter((term) => text.includes(term)).length;
}

function scoreCandidate(candidate, terms) {
  let score = 0;
  if (mentionsPeople(candidate.caption)) score += 4;
  if (candidate.credit) score += 2;
  score += Math.min(4, termOverlap(candidate.caption, terms));
  score += Math.min(3, Math.round((candidate.width || 0) / 500));
  return score;
}

export async function collectImages(sources, { max = 3, checks = 24, terms = [] } = {}) {
  const candidates = [];
  const seen = new Set();
  const titles = (sources || []).map((source) => normalizeText(source?.title)).filter(Boolean);
  const story = storyTerms(terms.length ? terms : titles);
  for (const source of sources || []) {
    const url = cleanImageUrl(source?.image);
    if (!url || seen.has(url) || isJunkImage(url)) continue;
    seen.add(url);
    const parts = splitCredit(
      usableCaption(source, titles),
      cleanCaptionText(source.imageCredit || source.credit).slice(0, 120)
    );
    if (!parts.caption || !isPhotograph(parts.caption)) continue;
    candidates.push({ url, caption: parts.caption, credit: parts.credit, outlet: source.outlet || '' });
  }
  if (!candidates.length) return [];

  // The check costs a download, so only the strongest candidates are worth
  // it. The order of the sources must not decide the picture.
  const ranked = candidates
    .map((candidate) => ({ ...candidate, rank: scoreCandidate(candidate, story) }))
    .sort((a, b) => b.rank - a.rank);

  const accepted = [];
  await pool(ranked.slice(0, checks), 4, async (candidate) => {
    const quality = await checkImageQuality(candidate.url).catch(() => ({ ok: false }));
    if (quality.ok) accepted.push({ ...candidate, width: quality.dims?.width || 0 });
  });

  accepted.sort((a, b) => scoreCandidate(b, story) - scoreCandidate(a, story) || b.width - a.width);

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

/**
 * Puts the remaining photos after the first paragraph of evenly spaced sections.
 * A picture that was placed by an earlier run and is no longer accepted goes
 * away - an uncaptioned photo in the middle of the text is worse than none.
 */
export function assignImages(sections, images) {
  if (!Array.isArray(sections) || !sections.length) return sections;
  const inline = images.slice(1);
  if (!inline.length) {
    return sections.map((section) => {
      if (!section.image) return section;
      const rest = { ...section };
      delete rest.image;
      return rest;
    });
  }

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
    if (!image) {
      if (!section.image) return section;
      const rest = { ...section };
      delete rest.image;
      return rest;
    }
    return {
      ...section,
      image: { url: image.url, caption: image.caption || '', credit: image.credit || '' },
    };
  });
}
