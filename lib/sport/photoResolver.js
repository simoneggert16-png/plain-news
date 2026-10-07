import fs from 'fs';
import path from 'path';

// In-memory cache for resolved player photo URLs
const PHOTO_CACHE = new Map();

export async function resolvePlayerPhoto(player) {
  if (!player) return null;

  const slug = player.slug || player.name?.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  // 1. Check in-memory cache
  if (PHOTO_CACHE.has(slug)) {
    return PHOTO_CACHE.get(slug);
  }

  // 2. Check local curated cutout file
  const localPath = path.join(process.cwd(), 'public', 'sport', 'players', `${slug}.png`);
  if (fs.existsSync(localPath)) {
    const url = `/sport/players/${slug}.png`;
    PHOTO_CACHE.set(slug, url);
    return url;
  }

  // 3. Check official ESPN / provider headshot
  if (player.athlete?.headshot?.href) {
    const url = player.athlete.headshot.href;
    PHOTO_CACHE.set(slug, url);
    return url;
  }

  // 4. Query Wikipedia / Wikimedia Commons API
  try {
    const query = encodeURIComponent(`${player.name} football`);
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrlimit=1&prop=pageimages&pithumbsize=300&format=json`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'PlainNewsBot/1.0 (news@plain-news.ch)' },
      next: { revalidate: 86400 } // cache 24h
    });

    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages || {};
      const first = Object.values(pages)[0];
      if (first?.thumbnail?.source) {
        const url = first.thumbnail.source;
        PHOTO_CACHE.set(slug, url);
        return url;
      }
    }
  } catch (e) {
    // Silently continue to fallback
  }

  // 5. Fallback: team logo or null
  return player.teamLogo || null;
}
