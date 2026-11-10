'use client';
import { useState, useEffect } from 'react';
import { CATEGORIES } from '@/lib/config.mjs';

const LEGACY_TOPIC_MAP = {
  world: 'welt',
  politics: 'politik',
  business: 'wirtschaft',
  science: 'wissen',
  climate: 'klima',
  health: 'gesundheit',
  culture: 'kultur',
  geopolitics: 'welt',
  europe: 'welt',
  switzerland: 'politik',
  bundeshaus: 'politik',
  markets: 'wirtschaft',
  snb: 'wirtschaft',
  finance: 'wirtschaft',
  ai: 'tech',
  cyber: 'tech',
  space: 'wissen',
  energy: 'klima',
  alps: 'klima',
  medicine: 'gesundheit',
  society: 'kultur',
  football: 'sport',
  f1: 'sport',
  tennis: 'sport',
  eishockey: 'sport',
  hockey: 'sport',
  ski: 'sport',
};

function secureCookieSuffix() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

function normalizeTopics(rawTopics) {
  if (!Array.isArray(rawTopics) || rawTopics.length === 0) return CATEGORIES;
  const categorySet = new Set(CATEGORIES);
  const matched = new Set();

  for (const item of rawTopics) {
    if (typeof item !== 'string') continue;
    const slug = item.trim().toLowerCase();
    if (!slug) continue;
    if (categorySet.has(slug)) {
      matched.add(slug);
      continue;
    }
    if (slug === 'switzerland' && categorySet.has('schweiz')) {
      matched.add('schweiz');
      continue;
    }
    const mapped = LEGACY_TOPIC_MAP[slug];
    if (mapped && categorySet.has(mapped)) {
      matched.add(mapped);
    }
  }

  // Never hide all articles if stored beat slugs came from a mismatched taxonomy
  if (matched.size === 0) return CATEGORIES;
  return CATEGORIES.filter((c) => matched.has(c));
}

export default function TopicFilter({ locale, t }) {
  const [selectedTopics, setSelectedTopics] = useState(CATEGORIES);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    // Read plain_topics cookie and normalize legacy English beat slugs
    const match = document.cookie.match(/(?:^|;\s*)plain_topics=([^;]+)/);
    if (match) {
      try {
        const rawTopics = JSON.parse(decodeURIComponent(match[1]));
        if (Array.isArray(rawTopics) && rawTopics.length > 0) {
          const normalized = normalizeTopics(rawTopics);
          setSelectedTopics(normalized);
          setIsCustom(normalized.length !== CATEGORIES.length);
        }
      } catch (e) {}
    }
  }, []);

  function toggleTopic(cat) {
    let next;
    if (selectedTopics.includes(cat)) {
      if (selectedTopics.length === 1) return; // Keep at least one
      next = selectedTopics.filter((c) => c !== cat);
    } else {
      next = [...selectedTopics, cat];
    }
    setSelectedTopics(next);
    setIsCustom(next.length !== CATEGORIES.length);
    document.cookie = `plain_topics=${encodeURIComponent(JSON.stringify(next))};path=/;max-age=31536000;samesite=lax${secureCookieSuffix()}`;
  }

  function selectAll() {
    setSelectedTopics(CATEGORIES);
    setIsCustom(false);
    document.cookie = `plain_topics=;path=/;max-age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT;samesite=lax${secureCookieSuffix()}`;
  }

  const hiddenTopics = isCustom ? CATEGORIES.filter((c) => !selectedTopics.includes(c)) : [];
  const filterCss = hiddenTopics.length
    ? hiddenTopics.map((c) => `[data-topic="${c}"] { display: none !important; }`).join('\n')
    : '';

  return (
    <div className="topic-filter-bar">
      {filterCss && <style dangerouslySetInnerHTML={{ __html: filterCss }} />}
      <div className="topic-filter-label">
        <span className="label">{locale === 'de' ? 'FEED-FILTER:' : 'YOUR TOPICS:'}</span>
      </div>
      <div className="topic-filter-pills">
        <button
          type="button"
          onClick={selectAll}
          className={`topic-pill ${!isCustom ? 'active' : ''}`}
        >
          {locale === 'de' ? 'Alle Themen' : 'All Topics'}
        </button>
        {CATEGORIES.map((c) => {
          const active = selectedTopics.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggleTopic(c)}
              className={`topic-pill ${active ? 'active' : ''}`}
              title={`${t.cat[c]} ${active ? 'abwählen' : 'auswählen'}`}
            >
              <span>{t.cat[c]}</span>
              <span className="pill-check">{active ? '✓' : '+'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
