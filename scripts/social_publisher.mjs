import fs from 'node:fs';
import path from 'node:path';

// Load .env
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

/**
 * Multi-Platform Social Publisher for PLAIN.
 * Supported APIs:
 * - Meta Graph API (Instagram Business / Creator & Facebook Page)
 * - TikTok Content Posting API v2
 */

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

export async function publishToFacebook({ pageId = FACEBOOK_PAGE_ID, accessToken = META_ACCESS_TOKEN, message, link, photoUrl }) {
  if (!pageId || !accessToken) {
    throw new Error('Missing Facebook PAGE_ID or META_ACCESS_TOKEN');
  }

  let endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
  let body = { message, access_token: accessToken };

  if (photoUrl) {
    endpoint = `https://graph.facebook.com/v21.0/${pageId}/photos`;
    body = { caption: message, url: photoUrl, access_token: accessToken };
  } else if (link) {
    body.link = link;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Facebook API error: ${JSON.stringify(data)}`);
  return data;
}

export async function publishToInstagramSingle({ accountId = INSTAGRAM_ACCOUNT_ID, accessToken = META_ACCESS_TOKEN, imageUrl, caption }) {
  if (!accountId || !accessToken) {
    throw new Error('Missing INSTAGRAM_ACCOUNT_ID or META_ACCESS_TOKEN');
  }

  // 1. Create Media Container
  const containerRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken,
    }),
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok || !containerData.id) {
    throw new Error(`Instagram container creation failed: ${JSON.stringify(containerData)}`);
  }

  const creationId = containerData.id;

  // 2. Publish Container
  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`Instagram publishing failed: ${JSON.stringify(publishData)}`);
  }

  return publishData;
}

export async function publishToInstagramCarousel({ accountId = INSTAGRAM_ACCOUNT_ID, accessToken = META_ACCESS_TOKEN, imageUrls = [], caption }) {
  if (!accountId || !accessToken) {
    throw new Error('Missing INSTAGRAM_ACCOUNT_ID or META_ACCESS_TOKEN');
  }
  if (!imageUrls.length || imageUrls.length > 10) {
    throw new Error('Instagram carousels require between 2 and 10 images');
  }

  // 1. Create sub-item containers
  const childIds = [];
  for (const url of imageUrls) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: url,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    });
    const d = await res.json();
    if (!res.ok || !d.id) throw new Error(`Carousel item failed: ${JSON.stringify(d)}`);
    childIds.push(d.id);
  }

  // 2. Create Carousel Container
  const carouselRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds,
      caption: caption,
      access_token: accessToken,
    }),
  });
  const carouselData = await carouselRes.json();
  if (!carouselRes.ok || !carouselData.id) {
    throw new Error(`Carousel container creation failed: ${JSON.stringify(carouselData)}`);
  }

  // 3. Publish Carousel
  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: carouselData.id,
      access_token: accessToken,
    }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) throw new Error(`Carousel publish failed: ${JSON.stringify(publishData)}`);

  return publishData;
}

export async function publishToInstagramReel({ accountId = INSTAGRAM_ACCOUNT_ID, accessToken = META_ACCESS_TOKEN, videoUrl, caption }) {
  if (!accountId || !accessToken) {
    throw new Error('Missing INSTAGRAM_ACCOUNT_ID or META_ACCESS_TOKEN');
  }

  // 1. Create Reel Container
  const containerRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption,
      access_token: accessToken,
    }),
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok || !containerData.id) {
    throw new Error(`Instagram Reel container failed: ${JSON.stringify(containerData)}`);
  }

  const creationId = containerData.id;

  // Poll for video processing
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status !== 'FINISHED' && attempts < 20) {
    await new Promise((r) => setTimeout(r, 4000));
    const statusRes = await fetch(`https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${accessToken}`);
    const statusData = await statusRes.json();
    status = statusData.status_code;
    if (status === 'ERROR') throw new Error(`Video processing failed: ${JSON.stringify(statusData)}`);
    attempts++;
  }

  // 2. Publish Reel
  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) throw new Error(`Reel publish failed: ${JSON.stringify(publishData)}`);

  return publishData;
}

export async function publishToTikTokVideo({ accessToken = TIKTOK_ACCESS_TOKEN, videoUrl, title }) {
  if (!accessToken) {
    throw new Error('Missing TIKTOK_ACCESS_TOKEN');
  }

  // TikTok Content Posting API v2 Direct Post via Pull from URL
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: title,
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  });

  const initData = await initRes.json();
  if (!initRes.ok || initData.error?.code !== 'ok') {
    throw new Error(`TikTok Publish Init Error: ${JSON.stringify(initData)}`);
  }

  return initData;
}
