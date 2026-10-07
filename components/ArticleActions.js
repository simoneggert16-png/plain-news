'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ArticleActions({ slug, title, locale, isDe }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedNoteIndicator, setSavedNoteIndicator] = useState(false);

  useEffect(() => {
    // 1. Check if saved
    try {
      const stored = localStorage.getItem('plain_saved_articles');
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list) && list.some(item => item.slug === slug)) {
          setSaved(true);
        }
      }
    } catch (e) {}

    // 2. Load existing note if any
    try {
      const storedNotes = localStorage.getItem('plain_saved_notes');
      if (storedNotes) {
        const allNotes = JSON.parse(storedNotes);
        if (allNotes && allNotes[slug]) {
          setNoteText(allNotes[slug]);
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

  function handleSaveNote(val) {
    setNoteText(val);
    try {
      const storedNotes = localStorage.getItem('plain_saved_notes');
      const allNotes = storedNotes ? JSON.parse(storedNotes) : {};
      allNotes[slug] = val;
      localStorage.setItem('plain_saved_notes', JSON.stringify(allNotes));

      // Also ensure article is in saved list if a note was written
      if (val.trim() && !saved) {
        toggleSave();
      }

      setSavedNoteIndicator(true);
      setTimeout(() => setSavedNoteIndicator(false), 2000);
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
          onClick={() => setShowNoteBox(!showNoteBox)}
          className={`art-action-btn ${noteText.trim() || showNoteBox ? 'active' : ''}`}
          title={isDe ? 'Persönliche Notiz hinzufügen' : 'Add personal note'}
        >
          <span>📝 {noteText.trim() ? (isDe ? 'NOTIZ (1)' : 'NOTE (1)') : (isDe ? 'NOTIZ' : 'NOTE')}</span>
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

      {/* Slide-out / Expandable Note Box */}
      {showNoteBox && (
        <div className="art-inline-note-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span className="label" style={{ fontSize: '10px' }}>
              📝 {isDe ? 'PERSÖNLICHE NOTIZ ZU DIESEM ARTIKEL' : 'PERSONAL NOTE'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {savedNoteIndicator && (
                <span style={{ fontSize: '10px', color: 'var(--up)', fontFamily: 'var(--mono)' }}>
                  ● {isDe ? 'Gespeichert' : 'Saved'}
                </span>
              )}
              <Link href={`/${locale}/saved`} style={{ fontSize: '10px', fontFamily: 'var(--mono)', textDecoration: 'underline' }}>
                {isDe ? 'Alle Notizen ansehen →' : 'View all notes →'}
              </Link>
            </div>
          </div>
          <textarea
            rows={3}
            value={noteText}
            onChange={(e) => handleSaveNote(e.target.value)}
            placeholder={isDe ? 'Deine Notiz, Zitate oder Gedanken zu diesem Artikel (speichert automatisch)…' : 'Add private notes or citations (auto-saves)…'}
            className="art-inline-note-input"
          />
        </div>
      )}
    </div>
  );
}
