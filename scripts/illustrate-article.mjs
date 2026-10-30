#!/usr/bin/env node
// Gives a published investigation the photos of its own sources.
//
// The desk files the text of every source it reads, but a piece that went out
// before the pictures were collected reaches the site without a lead image.
// This walks the dossier of a published article, asks the sources for their
// lead photo, and writes the accepted ones into the article and the index.
//
//   node scripts/illustrate-article.mjs <article-slug>
//
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from '../bots/lib/browse.mjs';
import { collectImages, assignImages } from '../bots/lib/illustrate.mjs';
import { isJunkImage } from '../bots/lib/media.mjs';
import { loadIndex, saveIndex, loadArticle, saveArticle, toIndexEntry } from '../bots/lib/store.mjs';

const CONTENT = path.join(process.cwd(), 'content');
const DOSSIERS = path.join(CONTENT, 'investigations');

const slug = process.argv[2] || '';
if (!slug) {
  console.error('usage: node scripts/illustrate-article.mjs <article-slug>');
  process.exit(1);
}

const article = loadArticle(slug);
if (!article) {
  console.error(`no article ${slug}`);
  process.exit(1);
}

const dossierSlug = article.meta?.investigation || slug;
const dossierFile = path.join(DOSSIERS, `${dossierSlug}.json`);
if (!fs.existsSync(dossierFile)) {
  console.error(`no dossier ${dossierSlug} for ${slug}`);
  process.exit(1);
}
const dossier = JSON.parse(fs.readFileSync(dossierFile, 'utf8'));

let filled = 0;
for (const source of dossier.sources || []) {
  if (!source.url) continue;
  // Every source is asked again: the rules for what counts as a photograph
  // get stricter, and a caption that belonged to a picture in the sidebar
  // must not stay on the file.
  try {
    const page = await openPage(source.url, { maxChars: 600 });
    if (!page.image || isJunkImage(page.image)) {
      delete source.image;
      delete source.imageCaption;
      delete source.imageCredit;
      continue;
    }
    source.image = page.image;
    if (page.imageCaption) source.imageCaption = page.imageCaption;
    else delete source.imageCaption;
    if (page.imageCredit) source.imageCredit = page.imageCredit;
    else delete source.imageCredit;
    filled += 1;
    console.log(`PHOTO   ${source.outlet}: ${page.image.slice(0, 90)}`);
  } catch (err) {
    console.log(`PHOTO   ${source.outlet}: no picture (${err.message})`);
  }
}
fs.writeFileSync(dossierFile, `${JSON.stringify(dossier, null, 2)}\n`);

const pictures = await collectImages(dossier.sources || [], { max: 3 });
if (!pictures.length) {
  console.log('no usable picture in the sources.');
  process.exit(0);
}

const hero = pictures[0];
article.image = hero.url;
article.imageCredit = hero.credit || null;
for (const locale of Object.keys(article.locales || {})) {
  const loc = article.locales[locale];
  loc.imageCaption = hero.caption || '';
  if (Array.isArray(loc.sections)) {
    const withImage = assignImages(loc.sections, pictures);
    loc.sections = withImage;
  }
}
saveArticle(article);

const index = loadIndex();
if (index.articles.some((a) => a.slug === slug)) {
  index.articles = index.articles.map((a) => (a.slug === slug ? toIndexEntry(article) : a));
  saveIndex(index);
}

console.log(`PHOTO   hero from ${hero.outlet || 'source'}: ${hero.url}`);
console.log(`PHOTO   ${slug}: ${pictures.length} picture(s) placed.`);
