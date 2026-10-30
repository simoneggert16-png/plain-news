// The listing index: what a card on a list page actually needs.
//
// The full index carries the body-adjacent fields of every story in every
// language (facts, captions, all ten translations). That is 5.6 MB of JSONB
// that had to travel from Supabase into every server render, and it cost the
// site 20+ seconds of first byte. A list page shows a title, a line of text
// and a picture - so that is all the listing index keeps, per language.

export const LISTING_FIELDS = [
  'slug',
  'category',
  'form',
  'image',
  'imageCredit',
  'video',
  'importance',
  'publishedAt',
  'updatedAt',
  'sourceCount',
  'sourcePolicy',
];

const LOCALE_FIELDS = ['title', 'dek', 'standfirst'];

const pick = (obj, keys) => {
  const out = {};
  for (const key of keys) {
    const value = obj?.[key];
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
};

/**
 * One list entry for one language.
 * If the story has no text in that language, the source language comes along
 * so the card is never empty. The English title is always kept as well: the
 * ranking weighs the words of a headline, and it must see the same words in
 * every language.
 */
export function toListing(article, locale, sourceLocale = 'en') {
  const out = pick(article, LISTING_FIELDS);
  const local = article.locales?.[locale];
  const source = article.locales?.[sourceLocale];
  const locales = {};
  if (local?.title) locales[locale] = pick(local, LOCALE_FIELDS);
  else if (source?.title) locales[sourceLocale] = pick(source, LOCALE_FIELDS);
  if (locale !== sourceLocale && source?.title && !locales[sourceLocale]) {
    locales[sourceLocale] = { title: source.title };
  }
  if (Object.keys(locales).length) out.locales = locales;
  return out;
}

/** The whole archive as a list index for one language. */
export function buildListing(articles, locale, sourceLocale = 'en') {
  return articles
    .filter((a) => a && a.slug)
    .map((a) => toListing(a, locale, sourceLocale));
}

/** Key of the blob that holds the list index for one language. */
export const listingKey = (locale) => `index-lite-${locale}`;
