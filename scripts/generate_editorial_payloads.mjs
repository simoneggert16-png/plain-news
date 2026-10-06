import fs from 'fs';
import path from 'path';

// Creative Automation Pipeline: News Articles -> 9:16 Swiss Modernist Short-Form Video Payloads
const index = JSON.parse(fs.readFileSync('content/index.json', 'utf8'));
const articles = index.articles.slice(0, 10);

const BROLL_DICTIONARY = {
  tech: ['server racks dark', 'brutalist architecture glass', 'empty terminal screen glowing', 'night city fiber optics'],
  politics: ['parliament steps stone', 'archival press room microphones', 'empty government corridor shadows', 'flag fluttering slow motion fog'],
  climate: ['industrial chimney mist dawn', 'moody river water texture', 'glacier ice dark waters', 'wind turbines distant horizon'],
  health: ['laboratory microscope cold light', 'empty hospital corridor sterile', 'medical vial dark background', 'abstract cellular flow'],
  business: ['empty trading floor night', 'financial district skyscrapers low angle', 'stock ticker reflection window', 'metro train window blur'],
  world: ['cargo port containers night', 'border checkpoint rain', 'harbor drone shot moody', 'coastal radar installation'],
  science: ['antarctic ice shelf vast', 'observatory dome night stars', 'particle detector geometry brutalist', 'deep space telescope data'],
};

export function generateEditorialPayload(article, locale = 'de') {
  const l = article.locales[locale] || article.locales.en;
  const cat = article.category || 'world';

  // 1. Hook Text: Max. 5 words
  let hook = '';
  if (article.slug.includes('pentagon-stops-using-anthropic')) {
    hook = 'Pentagon stoppt Anthropic-KI.';
  } else if (article.slug.includes('uk-oil-refinery')) {
    hook = 'Ölraffinerie bricht 58 Umweltauflagen.';
  } else if (article.slug.includes('francis-halzen-wins')) {
    hook = 'Physik-Nobelpreis für Geisterteilchen vergeben.';
  } else if (article.slug.includes('cancer-rates')) {
    hook = 'Krebsraten bei Jungen steigen.';
  } else if (article.slug.includes('cargo-ship-sinks')) {
    hook = 'Frachtschiff nach Drohnenangriff gesunken.';
  } else {
    const rawWords = l.title.split(' ').slice(0, 5);
    hook = rawWords.join(' ') + '.';
  }

  // 2. Fact Text: Max. 18 words, two sentences (pure facts)
  let factText = '';
  if (article.slug.includes('pentagon-stops-using-anthropic')) {
    factText = 'US-Militär beendet Nutzung von Claude. Das Unternehmen wurde als Lieferkettenrisiko eingestuft.';
  } else if (article.slug.includes('uk-oil-refinery')) {
    factText = 'Stanlow-Raffinerie überschritt Grenzwerte für Cyanid achtfach. Die britische Umweltbehörde ermittelt offiziell.';
  } else if (article.slug.includes('francis-halzen-wins')) {
    factText = 'Francis Halzen erhält Auszeichnung für Südpol-Observatorium. Tausende Eissensoren messen kosmische Neutrinos.';
  } else {
    const f1 = (l.facts?.[0] || l.dek).split('.')[0].trim();
    factText = f1.slice(0, 110) + '.';
  }

  // 3. Closing
  const closing = 'plain-news.ch · News without noise.';

  // 4. B-Roll Curation
  const brollTerms = BROLL_DICTIONARY[cat] || ['architectural brutalism', 'cinematic city fog', 'empty press room'];

  return {
    slug: article.slug,
    title: l.title,
    category: cat,
    hook_text: hook,
    fact_text: factText,
    closing_text: closing,
    broll_search_terms: brollTerms,
    audio_mood: 'ambient_minimal_drone_tape_loop',
    voiceover_script: `${hook} ${factText} Verifizierte Quellen auf plain-news Punkt c h.`,
    brand_visuals: {
      aspect_ratio: '9:16',
      fps: 24,
      background_card: '#F4F1EA',
      text_color: '#111111',
      serif_font: 'Playfair Display / Instrument Serif',
      mono_font: 'JetBrains Mono / Courier',
      grain_overlay: 'subtle_35mm_film_grain',
      transition: 'hard_editorial_cut',
    },
    instagram_caption: `${hook}\n\n${factText}\n\n—\nplain-news.ch | Nachrichten ohne Lärm.\n0 Werbung. 0 Meinungsjournalismus. 2+ Quellen Pflicht.`,
    status: 'ready_to_render',
  };
}

const payloads = articles.map((a) => generateEditorialPayload(a, 'de'));
fs.writeFileSync('social_content/editorial_video_payloads.json', JSON.stringify(payloads, null, 2), 'utf8');

console.log(`Generated ${payloads.length} high-end Swiss Modernism editorial video payloads.`);
