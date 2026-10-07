'use client';
import { useState, useEffect } from 'react';

export default function ArticleComments({ slug, locale, isDe }) {
  const [comments, setComments] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [postSuccess, setPostSuccess] = useState(false);
  
  // Track live translations per comment ID: { [id]: { translated: string, showTranslated: boolean, loading: boolean } }
  const [translations, setTranslations] = useState({});

  // Fetch comments from server so all readers see comments in real time
  useEffect(() => {
    let active = true;

    async function loadComments() {
      try {
        setLoadingComments(true);
        const res = await fetch(`/api/community/comments?slug=${encodeURIComponent(slug)}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data.comments)) {
            // Also check localStorage for local fallback or merge
            const localSaved = localStorage.getItem(`plain_comments_${slug}`);
            let localList = [];
            try {
              if (localSaved) localList = JSON.parse(localSaved);
            } catch (e) {}

            const mergedMap = new Map();
            data.comments.forEach(c => mergedMap.set(c.id, c));
            localList.forEach(c => {
              if (!mergedMap.has(c.id)) mergedMap.set(c.id, c);
            });

            const merged = Array.from(mergedMap.values()).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            setComments(merged);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to load server comments, falling back to local:', err);
      } finally {
        if (active) setLoadingComments(false);
      }

      // Fallback to local storage if network error
      try {
        const saved = localStorage.getItem(`plain_comments_${slug}`);
        if (saved && active) {
          setComments(JSON.parse(saved));
        }
      } catch {}
    }

    loadComments();
    return () => { active = false; };
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    setPostSuccess(false);

    const authorName = name.trim() || (isDe ? 'Anonym' : 'Anonymous Reader');
    const commentContent = text.trim();

    try {
      // Direct server-side persistence (no blocking AI moderation)
      const postRes = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          author: authorName,
          content: commentContent,
        }),
      });

      let updatedList = [];
      if (postRes.ok) {
        const postData = await postRes.json();
        updatedList = postData.comments || [];
        setComments(updatedList);
      } else {
        const newLocalComment = {
          id: 'c_' + Date.now(),
          author: authorName,
          date: new Date().toISOString(),
          content: commentContent,
          verified: true,
        };
        updatedList = [newLocalComment, ...comments];
        setComments(updatedList);
      }

      try {
        localStorage.setItem(`plain_comments_${slug}`, JSON.stringify(updatedList));
      } catch {}

      setText('');
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);
    } catch (err) {
      console.error('Comment error:', err);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span className="comments-server-badge">
              ● Live-Sync (Server-Synchronisiert)
            </span>
            <span className="comments-ai-badge" style={{ fontSize: '9.5px' }}>
              🌐 Live-Übersetzung verfügbar
            </span>
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
            placeholder={isDe ? 'Dein Name / Handle (optional)' : 'Your name / handle (optional)'}
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
            ✓ {isDe ? 'Kommentar erfolgreich veröffentlicht!' : 'Comment published successfully!'}
          </div>
        )}

        <div className="comment-actions">
          <button type="submit" disabled={submitting || !text.trim()} className="btn btn-inv comment-btn">
            {submitting ? (isDe ? 'Wird veröffentlicht…' : 'Publishing…') : (isDe ? 'Beitrag veröffentlichen' : 'Publish Note')}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="comments-list">
        {loadingComments ? (
          <p className="comments-empty" style={{ fontStyle: 'italic', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '12px' }}>
            {isDe ? 'Lade Beiträge vom Server…' : 'Loading contributions from server…'}
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
                      🌐 Live-Übersetzung ({locale.toUpperCase()})
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
                      <span>⏳ {isDe ? 'Übersetze…' : 'Translating…'}</span>
                    ) : isShowingTranslated ? (
                      <span>↩ {isDe ? 'Original anzeigen' : 'Show original'}</span>
                    ) : (
                      <span>🌐 {isDe ? `Live übersetzen (${locale.toUpperCase()})` : `Live translate (${locale.toUpperCase()})`}</span>
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
