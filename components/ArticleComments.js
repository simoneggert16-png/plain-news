'use client';
import { useState, useEffect, useCallback } from 'react';

export default function ArticleComments({ slug, locale, isDe }) {
  const [comments, setComments] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [postSuccess, setPostSuccess] = useState(false);
  const [postError, setPostError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // Track live translations per comment ID: { [id]: { translated: string, showTranslated: boolean, loading: boolean } }
  const [translations, setTranslations] = useState({});

  // Auto-load username from session if available
  useEffect(() => {
    try {
      const match = document.cookie.split('; ').find(r => r.startsWith('plain_session='));
      if (match) {
        const val = JSON.parse(decodeURIComponent(match.split('=')[1]));
        if (val?.username || val?.name) {
          setName(val.username || val.name);
        }
      }
    } catch {}
  }, []);

  // Fetch comments from server with deduplication
  const fetchComments = useCallback(async (isInitial = false) => {
    if (isInitial) setLoadingComments(true);
    try {
      const res = await fetch(`/api/community/comments?slug=${encodeURIComponent(slug)}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kommentare konnten nicht geladen werden.');
      if (!Array.isArray(data.comments)) throw new Error('Der Server hat keine gültige Kommentarliste zurückgegeben.');
      setComments(data.comments);
      setLoadError('');
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn('Comments sync notice:', err.message);
      if (isInitial) setLoadError(err.message);
    } finally {
      if (isInitial) setLoadingComments(false);
    }
  }, [slug]);

  // Initial load + Real-time sync polling every 4.5 seconds + focus listener
  useEffect(() => {
    fetchComments(true);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchComments(false);
      }
    }, 4500);

    function handleFocus() {
      fetchComments(false);
    }

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    setPostSuccess(false);
    setPostError('');

    const authorName = name.trim() || (isDe ? 'Anonym' : 'Anonymous Reader');
    const commentContent = text.trim();

    try {
      const postRes = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          author: authorName,
          content: commentContent,
        }),
      });

      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || (isDe ? 'Kommentar konnte nicht gespeichert werden.' : 'Comment could not be saved.'));
      if (!Array.isArray(postData.comments)) throw new Error(isDe ? 'Server hat keine gespeicherten Kommentare zurückgegeben.' : 'The server did not return the saved comments.');
      setComments(postData.comments);

      setText('');
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);
      
      // Re-fetch immediately to ensure cloud confirmation
      setTimeout(() => fetchComments(false), 800);
    } catch (err) {
      console.error('Comment submission error:', err);
      setPostError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTranslate = async (commentId, originalContent) => {
    const current = translations[commentId];

    if (current?.translated) {
      setTranslations((prev) => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          showTranslated: !prev[commentId].showTranslated,
        },
      }));
      return;
    }

    setTranslations((prev) => ({
      ...prev,
      [commentId]: { translated: '', showTranslated: false, loading: true },
    }));

    try {
      const res = await fetch('/api/community/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalContent,
          targetLocale: locale || 'de',
        }),
      });

      const data = await res.json();
      setTranslations((prev) => ({
        ...prev,
        [commentId]: {
          translated: data.translatedText || originalContent,
          showTranslated: true,
          loading: false,
        },
      }));
    } catch (err) {
      console.error('Translation error:', err);
      setTranslations((prev) => ({
        ...prev,
        [commentId]: { translated: originalContent, showTranslated: false, loading: false, error: true },
      }));
    }
  };

  return (
    <section className="art-section comments-section">
      <div className="comments-header">
        <div>
          <h2>{isDe ? 'Leser-Debatte & Community-Fakten' : 'Reader Discussion & Community Notes'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span className="comments-server-badge" title="Automatische Echtzeit-Synchronisation mit allen Lesern und Kollegen">
              ● Live-Sync aktiv (Echtzeit)
            </span>
            <span className="comments-ai-badge" style={{ fontSize: '9.5px' }}>
               Live-Übersetzung verfügbar
            </span>
            {lastSyncTime && (
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                Stand: {lastSyncTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <span className="comments-count">
          {comments.length} {isDe ? (comments.length === 1 ? 'Beitrag' : 'Beiträge') : (comments.length === 1 ? 'Contribution' : 'Contributions')}
        </span>
      </div>

      <p className="comments-guideline">
        {isDe
          ? 'Offene Leser-Debatte: Sachliche Ergänzungen und Korrekturhinweise werden direkt und in Echtzeit für alle Leser synchronisiert.'
          : 'Open reader debate: Factual contributions and additions are synchronized directly in real time across all readers.'}
      </p>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="comment-form">
        <div className="comment-inputs">
          <input
            type="text"
            placeholder={isDe ? 'Dein Name / Handle (z. B. Simon_CH)' : 'Your name / handle (e.g. Simon_CH)'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="comment-name-input"
            maxLength={50}
          />
          <textarea
            required
            rows={3}
            placeholder={isDe ? 'Kommentar oder Primärquelle hinzufügen…' : 'Add context or primary source link…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="comment-text-input"
            maxLength={1000}
          />
        </div>

        {postSuccess && (
          <div className="comment-moderation-success">
            ✓ {isDe ? 'Kommentar erfolgreich für alle Leser veröffentlicht!' : 'Comment published successfully for all readers!'}
          </div>
        )}
        {postError && (
          <p role="alert" className="comment-moderation-success" style={{ color: '#b42318' }}>
            {postError}
          </p>
        )}

        <div className="comment-actions">
          <button type="submit" disabled={submitting || !text.trim()} className="btn btn-inv comment-btn">
            {submitting ? (isDe ? 'Wird synchronisiert…' : 'Syncing…') : (isDe ? 'Beitrag veröffentlichen' : 'Publish Note')}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="comments-list">
        {loadError && (
          <p role="alert" className="comments-empty" style={{ color: '#b42318' }}>
            {loadError}
          </p>
        )}
        {loadingComments ? (
          <p className="comments-empty" style={{ fontStyle: 'italic', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '12px' }}>
            {isDe ? 'Lade Beiträge vom Cloud-Server…' : 'Loading contributions from cloud server…'}
          </p>
        ) : comments.length === 0 ? (
          <p className="comments-empty" style={{ fontStyle: 'italic', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '12px' }}>
            {isDe ? 'Noch keine Beiträge vorhanden. Sei der Erste, der verifizierten Kontext beiträgt.' : 'No notes yet. Be the first to provide factual context.'}
          </p>
        ) : (
          comments.map((c) => {
            const trans = translations[c.id];
            const isShowingTranslated = trans?.showTranslated && trans?.translated;
            const displayText = isShowingTranslated ? trans.translated : c.content;

            return (
              <div key={c.id} className="comment-card">
                <div className="comment-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="comment-author">{c.author}</span>
                  </div>
                  <span className="comment-date">
                    {new Date(c.date).toLocaleDateString(locale, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="comment-body">
                  <p className="comment-content">{displayText}</p>
                  {isShowingTranslated && (
                    <span className="comment-translated-tag">
                       Live-Übersetzung ({locale.toUpperCase()})
                    </span>
                  )}
                </div>

                <div className="comment-footer-actions">
                  <button
                    type="button"
                    onClick={() => handleToggleTranslate(c.id, c.content)}
                    disabled={trans?.loading}
                    className="comment-translate-btn"
                  >
                    {trans?.loading ? (
                      <span> {isDe ? 'Übersetze…' : 'Translating…'}</span>
                    ) : isShowingTranslated ? (
                      <span> {isDe ? 'Original anzeigen' : 'Show original'}</span>
                    ) : (
                      <span> {isDe ? `Live übersetzen (${locale.toUpperCase()})` : `Live translate (${locale.toUpperCase()})`}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
