'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function SavedArticlesPage() {
  const params = useParams();
  const locale = params?.locale || 'de';
  const isDe = locale === 'de';

  const [savedArticles, setSavedArticles] = useState([]);
  const [notes, setNotes] = useState({});
  const [scratchpad, setScratchpad] = useState('');
  const [activeTab, setActiveTab] = useState('articles'); // 'articles' | 'scratchpad'
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    // 1. Load saved articles
    try {
      const stored = localStorage.getItem('plain_saved_articles');
      if (stored) {
        setSavedArticles(JSON.parse(stored));
      }
    } catch (e) {}

    // 2. Load article notes
    try {
      const storedNotes = localStorage.getItem('plain_saved_notes');
      if (storedNotes) {
        setNotes(JSON.parse(storedNotes));
      }
    } catch (e) {}

    // 3. Load scratchpad
    try {
      const savedPad = localStorage.getItem('plain_scratchpad_notes');
      if (savedPad) {
        setScratchpad(savedPad);
      }
    } catch (e) {}
  }, []);

  function removeArticle(slug) {
    const updated = savedArticles.filter(item => item.slug !== slug);
    setSavedArticles(updated);
    try {
      localStorage.setItem('plain_saved_articles', JSON.stringify(updated));
    } catch (e) {}
  }

  function handleNoteChange(slug, text) {
    const updatedNotes = { ...notes, [slug]: text };
    setNotes(updatedNotes);
    try {
      localStorage.setItem('plain_saved_notes', JSON.stringify(updatedNotes));
    } catch (e) {}
  }

  function handleScratchpadChange(text) {
    setScratchpad(text);
    try {
      localStorage.setItem('plain_scratchpad_notes', text);
    } catch (e) {}
  }

  function copyAllNotes() {
    let content = `=== PLAIN. PERSÖNLICHE NOTIZEN & RECHERCHE ===\n\n`;
    if (scratchpad.trim()) {
      content += `--- ALLGEMEINE NOTIZEN ---\n${scratchpad}\n\n`;
    }
    savedArticles.forEach(a => {
      const n = notes[a.slug];
      if (n && n.trim()) {
        content += `--- ${a.title} ---\nURL: ${a.url || a.slug}\nNotiz: ${n}\n\n`;
      }
    });

    navigator.clipboard.writeText(content).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }

  return (
    <div className="saved-page-container">
      <header className="saved-header">
        <div className="label">{isDe ? 'PERSÖNLICHE ABLAGE & RECHERCHE' : 'PERSONAL ARCHIVE & RESEARCH'}</div>
        <h1 className="page-title">{isDe ? 'Gespeicherte Artikel & Notizen' : 'Saved Articles & Notebook'}</h1>
        <p className="saved-sub">
          {isDe
            ? 'Deine gemerkten Berichte, Primärquellen und persönlichen Randnotizen. Alle Daten bleiben lokal auf deinem Gerät gesichert.'
            : 'Your bookmarked stories, primary sources, and personal margin notes.'}
        </p>

        {/* Tab Switcher */}
        <div className="community-tab-bar" style={{ marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('articles')}
            className={`community-tab-btn ${activeTab === 'articles' ? 'active' : ''}`}
          >
             {isDe ? 'Gemerkte Artikel' : 'Saved Articles'} ({savedArticles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scratchpad')}
            className={`community-tab-btn ${activeTab === 'scratchpad' ? 'active' : ''}`}
          >
             {isDe ? 'Recherche-Notizbuch' : 'Research Scratchpad'}
          </button>
        </div>
      </header>

      {/* TAB 1: SAVED ARTICLES & INDIVIDUAL ARTICLE NOTES */}
      {activeTab === 'articles' && (
        <section className="saved-articles-section">
          {savedArticles.length === 0 ? (
            <div className="saved-empty-box">
              <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--muted)', fontSize: '14px' }}>
                {isDe
                  ? 'Du hast noch keine Artikel gemerkt. Klicke bei einem beliebigen Artikel auf „MERKEN“, um ihn hier abzulegen.'
                  : 'You have not saved any articles yet. Click “SAVE” on any story to bookmark it here.'}
              </p>
              <div style={{ marginTop: '14px' }}>
                <Link href={`/${locale}`} className="btn btn-inv" style={{ fontSize: '11px', padding: '8px 14px' }}>
                  {isDe ? '← Zum Newsfeed' : '← Back to Newsfeed'}
                </Link>
              </div>
            </div>
          ) : (
            <div className="saved-list">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button type="button" onClick={copyAllNotes} className="pill-btn">
                   {copiedAll ? (isDe ? 'Kopiert!' : 'Copied!') : (isDe ? 'Alle Notizen kopieren' : 'Copy all notes')}
                </button>
              </div>

              {savedArticles.map((item) => {
                const articleNote = notes[item.slug] || '';
                return (
                  <article key={item.slug} className="saved-card">
                    <div className="saved-card-main">
                      <div className="saved-card-meta">
                        <span className="meta">
                          {isDe ? 'GEMERKT AM:' : 'SAVED ON:'}{' '}
                          {item.savedAt ? new Date(item.savedAt).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'PLAIN'}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeArticle(item.slug)}
                          className="saved-remove-btn"
                          title={isDe ? 'Aus Gemerkten entfernen' : 'Remove from saved'}
                        >
                          ✕ {isDe ? 'Entfernen' : 'Remove'}
                        </button>
                      </div>

                      <h2 className="saved-card-title">
                        <Link href={`/${locale}/a/${item.slug}`}>
                          {item.title}
                        </Link>
                      </h2>

                      <div style={{ marginTop: '10px' }}>
                        <Link href={`/${locale}/a/${item.slug}`} className="saved-read-link">
                           {isDe ? 'Artikel jetzt lesen' : 'Read article now'}
                        </Link>
                      </div>
                    </div>

                    {/* Integrated Personal Article Note */}
                    <div className="saved-card-note-box">
                      <div className="note-box-head">
                        <label className="label">
                           {isDe ? 'DEINE PERSÖNLICHE NOTIZ ZU DIESEM ARTIKEL:' : 'YOUR NOTE FOR THIS ARTICLE:'}
                        </label>
                        {articleNote && (
                          <span style={{ fontSize: '10px', color: 'var(--up)', fontFamily: 'var(--mono)' }}>
                            ● {isDe ? 'Gespeichert' : 'Saved'}
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={articleNote}
                        onChange={(e) => handleNoteChange(item.slug, e.target.value)}
                        placeholder={isDe ? 'Schreibe eigene Gedanken, Querverweise oder Zitate hier auf… (wird automatisch gesichert)' : 'Add personal reflections, links, or notes here… (auto-saves)'}
                        className="saved-note-textarea"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: GENERAL SCRATCHPAD NOTEBOOK */}
      {activeTab === 'scratchpad' && (
        <section className="saved-scratchpad-section">
          <div className="scratchpad-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="label">
                 {isDe ? 'FREIES RECHERCHE-NOTIZBUCH (SCHNELLNOTIZEN):' : 'FREE RESEARCH SCRATCHPAD:'}
              </label>
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                {scratchpad.length} {isDe ? 'Zeichen' : 'chars'}
              </span>
            </div>
            <textarea
              rows={12}
              value={scratchpad}
              onChange={(e) => handleScratchpadChange(e.target.value)}
              placeholder={isDe ? 'Hier kannst du frei recherchierte Fakten, Thesen, Fragen oder Gedanken aufschreiben… Alles wird automatisch im Browser gespeichert.' : 'Type any free-form notes, research questions, or citations here…'}
              className="scratchpad-textarea"
            />
          </div>
        </section>
      )}
    </div>
  );
}
