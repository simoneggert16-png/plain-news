'use client';
import { useState, useEffect } from 'react';
import { CATEGORIES } from '@/lib/config.mjs';

export default function TopicFilter({ locale, t }) {
  const [selectedTopics, setSelectedTopics] = useState(CATEGORIES);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    // Read plain_topics cookie
    const match = document.cookie.match(/(?:^|;\s*)plain_topics=([^;]+)/);
    if (match) {
      try {
        const topics = JSON.parse(decodeURIComponent(match[1]));
        if (Array.isArray(topics) && topics.length > 0) {
          setSelectedTopics(topics);
          setIsCustom(topics.length !== CATEGORIES.length);
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
    document.cookie = `plain_topics=${encodeURIComponent(JSON.stringify(next))};path=/;max-age=31536000;samesite=lax`;
    window.location.reload();
  }

  function selectAll() {
    setSelectedTopics(CATEGORIES);
    setIsCustom(false);
    document.cookie = `plain_topics=;path=/;max-age=0`;
    window.location.reload();
  }

  return (
    <div className="topic-filter-bar">
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
