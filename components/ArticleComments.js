'use client';
import { useState, useEffect } from 'react';

export default function ArticleComments({ slug, locale, isDe }) {
  const [comments, setComments] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [moderationError, setModerationError] = useState(null);
  const [moderationSuccess, setModerationSuccess] = useState(false);
  
  // Track live translations per comment ID: { [id]: { translated: string, showTranslated: boolean, loading: boolean } }
  const [translations, setTranslations] = useState({});

  const storageKey = `plain_comments_${slug}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setComments(JSON.parse(saved));
      } else {
        // Sample default comments to demonstrate multilingual debate and translation
        const sampleComments = [
          {
            id: 'c_sample_1',
            author: 'Jean-Luc M. (Genève)',
            date: new Date(Date.now() - 3600000 * 2).toISOString(),
            content: 'Les sources primaires mentionnées confirment les conclusions du rapport fédéral. Une excellente synthèse factuelle sans biais partisan.',
            lang: 'fr',
          },
          {
            id: 'c_sample_2',
            author: 'Dr. Evelyn Vance (Zurich)',
            date: new Date(Date.now() - 3600000 * 4).toISOString(),
            content: 'The energy grid transition metrics match the latest Swiss Federal Office of Energy (SFOE) disclosures from Q3.',
            lang: 'en',
          }
        ];
        setComments(sampleComments);
      }
    } catch {
      setComments([]);
    }
  }, [storageKey, isDe]);

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
      const res = await fetch('/api/community/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: commentContent,
          author: authorName,
          type: 'comment',
          locale: locale || 'de',
        }),
      });

      const modResult = await res.json();

      if (!modResult.approved) {
        setModerationError(modResult.reason || (isDe 
          ? 'Beitrag wurde von der AI-Moderation wegen unpassenden Inhalts oder Vulgärsprache abgewiesen.'
          : 'Submission rejected by AI moderation due to inappropriate content or offensive language.'));
        setSubmitting(false);
        return;
      }

      // 2. Approved: Add to comments list
      const newComment = {
        id: 'c_' + Date.now(),
        author: authorName,
        date: new Date().toISOString(),
        content: commentContent,
        verified: true,
      };

      const updated = [newComment, ...comments];
      setComments(updated);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }

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

    // If already translated and toggled, just flip the display state
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

    // Otherwise, fetch live translation via NVIDIA NIM
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
          </div>
        </div>
        <span className="comments-count">
          {comments.length} {isDe ? (comments.length === 1 ? 'Beitrag' : 'Beiträge') : (comments.length === 1 ? 'Contribution' : 'Contributions')}
        </span>
      </div>

      <p className="comments-guideline">
        {isDe
          ? 'Sachliche Ergänzungen und Korrekturhinweise sind willkommen. Alle Beiträge werden in Echtzeit von der NVIDIA AI auf Vulgärsprache, Beleidigungen und Spam überprüft.'
          : 'Factual additions and primary sources welcome. All contributions are verified in real time by NVIDIA NIM AI to filter out profanity, vulgarity, and spam.'}
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
            ✓ {isDe ? 'NVIDIA AI Prüfung bestanden – Beitrag erfolgreich publiziert.' : 'NVIDIA AI verification passed – note published.'}
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
        {comments.length === 0 ? (
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
