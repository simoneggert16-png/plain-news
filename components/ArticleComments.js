'use client';
import { useState, useEffect } from 'react';

export default function ArticleComments({ slug, locale, isDe }) {
  const [comments, setComments] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [moderationError, setModerationError] = useState(null);
  const [moderationSuccess, setModerationSuccess] = useState(false);
  
  // Track live translations per comment ID: { [id]: { translated: string, showTranslated: boolean, loading: boolean } }
  const [translations, setTranslations] = useState({});

  // Fetch comments from server so colleagues and other readers see comments in real time
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
            // Server comments take priority
            data.comments.forEach(c => mergedMap.set(c.id, c));
            // Add any unsynced local comments
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
    setModerationError(null);
    setModerationSuccess(false);

    const authorName = name.trim() || (isDe ? 'Anonym' : 'Anonymous Reader');
    const commentContent = text.trim();

    try {
      // 1. Send to NVIDIA NIM AI Moderation Endpoint
      const modRes = await fetch('/api/community/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: commentContent,
          author: authorName,
          type: 'comment',
          locale: locale || 'de',
        }),
      });

      const modResult = await modRes.json();

      if (!modResult.approved) {
        setModerationError(modResult.reason || (isDe 
          ? 'Beitrag wurde von der AI-Moderation wegen unpassenden Inhalts oder Vulgärsprache abgewiesen.'
          : 'Submission rejected by AI moderation due to inappropriate content or offensive language.'));
        setSubmitting(false);
        return;
      }

      // 2. Persist to Server-Side Shared Storage so colleagues can see it
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
        // Fallback local update if server save had issue
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

      // Cache locally as well
      try {
        localStorage.setItem(`plain_comments_${slug}`, JSON.stringify(updatedList));
      } catch {}

      setText('');
      setModerationSuccess(true);
      setTimeout(() => setModerationSuccess(false), 4000);
    } catch (err) {
      console.error('Comment moderation error:', err);
      setModerationError(isDe 
        ? 'Prüfung fehlgeschlagen. Bitte versuche es erneut.'
        : 'Moderation check failed. Please try again.');
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
            <span className="comments-ai-badge">
              <span className="ai-dot"></span> NVIDIA AI Moderation & Live-Übersetzung aktiv
            </span>
            <span className="comments-server-badge" title={isDe ? 'Serverseitig synchronisiert – alle Leser sehen neue Beiträge' : 'Synced on server across readers'}>
              ● Live-Sync
            </span>
          </div>
        </div>
        <span className="comments-count">
          {comments.length} {isDe ? (comments.length === 1 ? 'Beitrag' : 'Beiträge') : (comments.length === 1 ? 'Contribution' : 'Contributions')}
        </span>
      </div>

      <p className="comments-guideline">
        {isDe
          ? 'Sachliche Ergänzungen und Korrekturhinweise sind willkommen. Alle Beiträge werden serverseitig synchronisiert und in Echtzeit von der NVIDIA AI auf Vulgärsprache, Beleidigungen und Spam überprüft.'
          : 'Factual additions and primary sources welcome. All contributions are server-synced and verified in real time by NVIDIA NIM AI to filter out profanity, vulgarity, and spam.'}
      </p>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="comment-form">
        <div className="comment-inputs">
          <input
            type="text"
            placeholder={isDe ? 'Dein Name / Initialen (optional)' : 'Your name / handle (optional)'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="comment-name-input"
            maxLength={50}
          />
          <textarea
            required
            rows={3}
            placeholder={isDe ? 'Faktenbasierten Kommentar oder Primärquelle hinzufügen…' : 'Add factual context or primary source link…'}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (moderationError) setModerationError(null);
            }}
            className="comment-text-input"
            maxLength={1000}
          />
        </div>

        {moderationError && (
          <div className="comment-moderation-alert">
            <span className="alert-icon">⚠️</span>
            <div className="alert-body">
              <strong>{isDe ? 'Beitrag abgewiesen' : 'Submission Rejected'}:</strong> {moderationError}
              <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.85 }}>
                {isDe ? 'Bitte passe deinen Wortlaut an und entferne vulgäre Ausdrücke oder Werbelinks.' : 'Please revise your wording to remove vulgar expressions or spam links.'}
              </div>
            </div>
          </div>
        )}

        {moderationSuccess && (
          <div className="comment-moderation-success">
            ✓ {isDe ? 'NVIDIA AI Prüfung bestanden – Kommentar erfolgreich auf dem Server publiziert.' : 'NVIDIA AI verification passed – note published to server.'}
          </div>
        )}

        <div className="comment-actions">
          <button type="submit" disabled={submitting || !text.trim()} className="btn btn-inv comment-btn">
            {submitting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="spinner-dots"></span> {isDe ? 'AI-Prüfung läuft…' : 'Verifying with AI…'}
              </span>
            ) : (
              isDe ? 'Beitrag einreichen & prüfen' : 'Submit & Verify Note'
            )}
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
                    <span className="comment-ai-verified" title={isDe ? 'Geprüft durch NVIDIA AI Moderation' : 'Verified by NVIDIA AI'}>
                      ✓ AI-geprüft
                    </span>
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
                      🌐 NVIDIA AI Live-Übersetzung ({locale.toUpperCase()})
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
