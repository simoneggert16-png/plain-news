// PLAIN. Media Intelligence & Curator
// Filters out boring logos, billboards & stock icons.
// Extracts authentic editorial photography and embedded video reports (YouTube, MP4, broadcasters).

const JUNK_PATTERNS = [
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
  /\b(?:340\/340|150\/150|100\/100|80\/80|64\/64)\b/i,
];

export function isJunkImage(url) {
  if (!url || typeof url !== 'string') return true;
  if (!/^https?:\/\//i.test(url)) return true;
  return JUNK_PATTERNS.some((pat) => pat.test(url));
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

export function extractImagesFromHtml(html) {
  if (!html) return [];
  const list = [];

  // OpenGraph image
  const og = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i);
  if (og && og[1] && !isJunkImage(og[1])) list.push({ url: og[1], score: 8 });

  // Twitter image
  const tw = html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i);
  if (tw && tw[1] && !isJunkImage(tw[1])) list.push({ url: tw[1], score: 7 });

  // Editorial article lead image
  const articleImg = html.match(/<article[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (articleImg && articleImg[1] && !isJunkImage(articleImg[1])) list.push({ url: articleImg[1], score: 9 });

  return list;
}

/** Score and select highest quality image and video from source material. */
export function curateMedia(sources = []) {
  let bestImage = null;
  let bestVideo = null;
  let highestScore = -1;

  for (const s of sources) {
    if (!bestVideo && s.video) {
      bestVideo = s.video;
    }

    if (s.image && !isJunkImage(s.image)) {
      let score = 5;
      // High-res photojournalism domains get bonus score
      if (/aljazeera|spiegel|nytimes|reuters|apnews|gettyimages|afp/i.test(s.image)) score += 5;
      if (/1920|1440|1080|1200/i.test(s.image)) score += 3;
      if (score > highestScore) {
        highestScore = score;
        bestImage = s.image;
      }
    }
  }

  return {
    image: bestImage,
    video: bestVideo,
  };
}
