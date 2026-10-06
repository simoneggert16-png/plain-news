'use client';
import { useState, useEffect } from 'react';

export default function ArticleComments({ slug, locale, isDe }) {
  const [comments, setComments] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const storageKey = `plain_comments_${slug}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setComments(JSON.parse(saved));
      } else {
        // Sample factual community note
        setComments([
          {
            id: 'c1',
            author: 'L. Keller (Zürich)',
            date: new Date(Date.now() - 3600000 * 2).toISOString(),
            content: isDe
              ? 'Wichtiger Kontext: Entsprechende Mitteilungen wurden auch direkt über die offiziellen Portale der zuständigen Behörden bestätigt.'
              : 'Important context: Official statements were cross-referenced and confirmed via public agency portals.',
          },
        ]);
      }
    } catch {
      // fallback
    }
  }, [storageKey, isDe]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    const newComment = {
      id: 'c_' + Date.now(),
      author: name.trim() || (isDe ? 'Anonym' : 'Anonymous Reader'),
      date: new Date().toISOString(),
      content: text.trim(),
    };

    const updated = [newComment, ...comments];
    setComments(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }

    setText('');
    setSubmitting(false);
  };

  return (
    <section className="art-section comments-section">
      <div className="comments-header">
        <h2>{isDe ? 'Leser-Debatte & Community-Fakten' : 'Reader Discussion & Community Notes'}</h2>
        <span className="comments-count">
          {comments.length} {isDe ? (comments.length === 1 ? 'Beitrag' : 'Beiträge') : (comments.length === 1 ? 'Contribution' : 'Contributions')}
        </span>
      </div>

      <p className="comments-guideline">
        {isDe
          ? 'Sachliche Ergänzungen, Korrekturhinweise und weiterführende Primärquellen sind willkommen. Keine Beleidigungen oder Parteipropaganda.'
          : 'Factual additions, source corrections, and primary references welcome. Strict zero-troll and zero-spin policy.'}
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
            onChange={(e) => setText(e.target.value)}
            className="comment-text-input"
            maxLength={1000}
          />
        </div>
        <div className="comment-actions">
          <button type="submit" disabled={submitting || !text.trim()} className="btn btn-inv comment-btn">
            {isDe ? 'Beitrag veröffentlichen' : 'Publish Note'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="comments-list">
        {comments.map((c) => (
          <div key={c.id} className="comment-card">
            <div className="comment-meta">
              <span className="comment-author">{c.author}</span>
              <span className="comment-date">{new Date(c.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="comment-content">{c.content}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
