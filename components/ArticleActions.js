'use client';
import { useState, useEffect } from 'react';

export default function ArticleActions({ slug, title, locale, isDe }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('plain_saved_articles');
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list) && list.some(item => item.slug === slug)) {
          setSaved(true);
        }
      }
    } catch (e) {}
  }, [slug]);

  function toggleSave() {
    try {
      const stored = localStorage.getItem('plain_saved_articles');
      let list = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(list)) list = [];

      if (saved) {
        list = list.filter(item => item.slug !== slug);
        setSaved(false);
      } else {
        list.push({
          slug,
          title,
          savedAt: new Date().toISOString(),
          url: window.location.href,
        });
        setSaved(true);
      }
      localStorage.setItem('plain_saved_articles', JSON.stringify(list));
    } catch (e) {}
  }

  function handlePrintPdf() {
    window.print();
  }

  function handleCopyShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="art-actions-bar">
      <div className="art-actions-group">
        <button
          type="button"
          onClick={toggleSave}
          className={`art-action-btn ${saved ? 'active' : ''}`}
          title={saved ? (isDe ? 'Gespeichert' : 'Saved') : (isDe ? 'Artikel merken' : 'Save article')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span>{saved ? (isDe ? 'GEMERKT' : 'SAVED') : (isDe ? 'MERKEN' : 'SAVE')}</span>
        </button>

        <button
          type="button"
          onClick={handlePrintPdf}
          className="art-action-btn"
          title={isDe ? 'Als PDF drucken oder speichern' : 'Print or save as PDF'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <span>PDF</span>
        </button>

        <button
          type="button"
          onClick={handleCopyShare}
          className="art-action-btn"
          title={isDe ? 'Link kopieren' : 'Copy link'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{copied ? (isDe ? 'KOPIERT!' : 'COPIED!') : (isDe ? 'TEILEN' : 'SHARE')}</span>
        </button>
      </div>
    </div>
  );
}
