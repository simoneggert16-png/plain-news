// Diagnose the image pipeline in CI: take the newest articles, re-fetch their
// source images exactly like the newsroom does, and print what the vision
// verifier answers for each provider.
//   node scripts/vision-check.mjs [count]
import fs from 'node:fs';
import { fetchArticleDetails } from '../bots/lib/feeds.mjs';
import { verifyAndCaptionImage } from '../bots/lib/vision.mjs';
import { curateMedia } from '../bots/lib/media.mjs';

const count = Math.max(1, Math.min(6, Number(process.argv[2]) || 3));
const index = JSON.parse(fs.readFileSync('content/index.json', 'utf8'));
const newest = [...index.articles]
  .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  .slice(0, count);

for (const entry of newest) {
  const article = JSON.parse(fs.readFileSync(`content/articles/${entry.slug}.json`, 'utf8'));
  const sources = [];
  for (const s of (article.sources || []).slice(0, 2)) {
    const d = await fetchArticleDetails(s.url).catch(() => ({}));
    sources.push({ outlet: s.outlet, url: s.url, image: d.image, caption: d.imageCaption, credit: d.imageCredit });
  }
  const media = curateMedia(sources);
  const started = Date.now();
  const result = media.image
    ? await verifyAndCaptionImage(media.image, {
        category: article.category,
        title: article.locales?.en?.title || article.title,
        facts: article.locales?.en?.facts || [],
        sources: article.sources || [],
        sourceCaption: media.caption,
        sourceCredit: media.credit,
      }).catch((e) => ({ verified: null, unavailable: true, reason: `threw: ${e.message}` }))
    : null;
  console.log(
    JSON.stringify({
      slug: entry.slug.slice(0, 48),
      hasImageInArticle: Boolean(article.image),
      candidateFound: Boolean(media.image),
      ms: Date.now() - started,
      verified: result?.verified ?? null,
      unavailable: result?.unavailable || false,
      reason: result?.rejectionReason || result?.reason || null,
      caption: result?.caption?.en?.slice(0, 70) || null,
      credit: result?.credit || null,
    })
  );
}
