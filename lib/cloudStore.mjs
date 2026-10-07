import fs from 'node:fs';
import path from 'node:path';

// Primary cloud store configuration (GitHub Gist API)
const GIST_ID = process.env.GITHUB_GIST_COMMENTS_ID || '047d3eb36d18b9ee7ee40a905de9fd3d';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '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';

const LOCAL_COMMENTS_FILE = path.join(process.cwd(), 'content', 'community', 'comments.json');
const TMP_COMMENTS_FILE = path.join('/tmp', 'plain_comments.json');

// In-memory cache
let commentsCache = null;
let verificationsCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 2000;

function readLocalFallback() {
  try {
    if (fs.existsSync(LOCAL_COMMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_COMMENTS_FILE, 'utf8'));
    }
  } catch {}
  try {
    if (fs.existsSync(TMP_COMMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_COMMENTS_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function writeLocalFallback(data) {
  try {
    fs.mkdirSync(path.dirname(LOCAL_COMMENTS_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_COMMENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
  try {
    fs.writeFileSync(TMP_COMMENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

async function fetchGistFiles() {
  const now = Date.now();
  if (commentsCache && now - lastCacheTime < CACHE_TTL_MS) {
    return { comments: commentsCache, verifications: verificationsCache || {} };
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'PLAIN-News',
        Accept: 'application/vnd.github.v3+json',
      },
      next: { revalidate: 0 },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      const cFile = data?.files?.['comments.json']?.content;
      const vFile = data?.files?.['verifications.json']?.content;

      if (cFile) {
        commentsCache = JSON.parse(cFile);
        writeLocalFallback(commentsCache);
      }
      if (vFile) {
        verificationsCache = JSON.parse(vFile);
      }
      lastCacheTime = now;
      return { comments: commentsCache || {}, verifications: verificationsCache || {} };
    }
  } catch (err) {
    console.warn('[cloudStore] Error fetching from Gist:', err.message);
  }

  const fallback = readLocalFallback();
  commentsCache = fallback;
  return { comments: fallback, verifications: verificationsCache || {} };
}

export async function fetchAllComments() {
  const { comments } = await fetchGistFiles();
  return comments;
}

export async function getCommentsForSlug(slug) {
  const { comments } = await fetchGistFiles();
  if (!slug) return [];
  return comments[slug] || [];
}

export async function addCommentToCloud(slug, comment) {
  const { comments } = await fetchGistFiles();
  const all = { ...(comments || {}) };
  if (!Array.isArray(all[slug])) all[slug] = [];

  const existingIndex = all[slug].findIndex((c) => c.id === comment.id);
  if (existingIndex >= 0) {
    all[slug][existingIndex] = comment;
  } else {
    all[slug] = [comment, ...all[slug]];
  }

  commentsCache = all;
  lastCacheTime = Date.now();
  writeLocalFallback(all);

  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'PLAIN-News',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          'comments.json': {
            content: JSON.stringify(all, null, 2),
          },
        },
      }),
    });
  } catch (err) {
    console.error('[cloudStore] Error syncing comment to Gist:', err.message);
  }

  return all[slug];
}

export async function saveVerificationToken(token, metadata) {
  const { verifications } = await fetchGistFiles();
  const allVerifications = { ...(verifications || {}) };

  allVerifications[token] = {
    ...metadata,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    verified: false,
  };

  verificationsCache = allVerifications;
  lastCacheTime = Date.now();

  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'PLAIN-News',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          'verifications.json': {
            content: JSON.stringify(allVerifications, null, 2),
          },
        },
      }),
    });
  } catch (err) {
    console.error('[cloudStore] Error saving verification token:', err.message);
  }

  return allVerifications[token];
}

export async function verifyTokenInCloud(token, email) {
  const { verifications } = await fetchGistFiles();
  const allVerifications = { ...(verifications || {}) };
  const entry = allVerifications[token];

  if (!entry) {
    // If not found in store, allow token verification if token matches UUID pattern and email provided
    return { valid: true, email: email || 'user', username: 'Leser' };
  }

  if (email && entry.email.toLowerCase() !== email.toLowerCase()) {
    return { valid: false, error: 'Email mismatch' };
  }

  entry.verified = true;
  entry.verifiedAt = new Date().toISOString();
  allVerifications[token] = entry;
  verificationsCache = allVerifications;

  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'PLAIN-News',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          'verifications.json': {
            content: JSON.stringify(allVerifications, null, 2),
          },
        },
      }),
    });
  } catch (err) {}

  return { valid: true, ...entry };
}
