'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CommunitySubmitSection({ locale, isDe }) {
  const [submissions, setSubmissions] = useState([]);
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [author, setAuthor] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('plain_community_articles');
      if (saved) {
        setSubmissions(JSON.parse(saved));
      } else {
        setSubmissions([
          {
            id: 'comm-1',
            title: isDe
              ? 'Offene Forschungsdaten: Neues Schweizer Repositorium für Klimadaten freigeschaltet'
              : 'Open Research Data: New Swiss Climate Open Repository Launched',
            sourceUrl: 'https://opendata.swiss',
            summary: isDe
              ? 'Behörden und Universitäten haben einen zentralen, offenen Zugriffspunkt für historische Wetter- und Schmelzdaten der Alpengletscher bereitgestellt.'
              : 'Public institutions and universities released a unified open-access repository for historical Alpine glacier melt data.',
            author: 'Marc V. (ETH Alumnus)',
            date: new Date(Date.now() - 3600000 * 5).toISOString(),
          },
        ]);
      }
    } catch {
      // fallback
    }
  }, [isDe]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !sourceUrl.trim() || !summary.trim()) return;

    const newSub = {
      id: 'comm-' + Date.now(),
      title: title.trim(),
      sourceUrl: sourceUrl.trim(),
      summary: summary.trim(),
      author: author.trim() || (isDe ? 'Community-Mitglied' : 'Community Contributor'),
      date: new Date().toISOString(),
    };

    const updated = [newSub, ...submissions];
    setSubmissions(updated);
    try {
      localStorage.setItem('plain_community_articles', JSON.stringify(updated));
    } catch {
      // ignore
    }

    setTitle('');
    setSourceUrl('');
    setSummary('');
    setAuthor('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="community-container">
      <div className="community-intro">
        <p className="lead-dek">
          {isDe
            ? 'Hier reicht die Community verifizierbare Nachrichtenartikel und Primärquellen ein. Jeder Beitrag wird anhand öffentlich zugänglicher Quellen offengelegt.'
            : 'Community-contributed news reports and primary sources. Factual submissions from verified public links.'}
        </p>
      </div>

      <div className="community-submit-box">
        <h2 className="sec-title">{isDe ? 'Artikel oder Primärquelle einreichen' : 'Submit Community Story or Primary Source'}</h2>
        <p className="form-subtext">
          {isDe
            ? 'Regel: Verlinke eine überprüfbare Primärquelle (offizielle Behördenmeldung, Firmen-Mitteilung, wissenschaftliches Paper oder Nachrichtenartikel). Keine Meinungsblogs.'
            : 'Requirement: Link a verifiable primary source (official agency disclosure, company announcement, peer-reviewed paper, or news item). No opinion blogs.'}
        </p>

        <form onSubmit={handleSubmit} className="community-form">
          <div className="form-grid">
            <input
              type="text"
              required
              placeholder={isDe ? 'Titel / Schlagzeile des Beitrags*' : 'Article headline / title*'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
            />
            <input
              type="url"
              required
              placeholder={isDe ? 'URL der Primärquelle (z.B. https://...)*' : 'Primary source URL (e.g. https://...)*'}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="input-field"
            />
          </div>

          <textarea
            required
            rows={3}
            placeholder={isDe ? 'Faktische Zusammenfassung (Kernaussage in 2-3 Sätzen)*' : 'Factual summary (core facts in 2-3 sentences)*'}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="input-textarea"
          />

          <div className="form-footer-row">
            <input
              type="text"
              placeholder={isDe ? 'Dein Name / Alias (optional)' : 'Your name / handle (optional)'}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="input-field-compact"
            />
            <button type="submit" className="btn btn-inv">
              {isDe ? 'Zur Veröffentlichung einreichen' : 'Submit Contribution'}
            </button>
          </div>

          {submitted && (
            <div className="submit-success-badge">
              ✓ {isDe ? 'Erfolgreich hinzugefügt!' : 'Successfully published to community board!'}
            </div>
          )}
        </form>
      </div>

      <div className="community-submissions-list">
        <h2 className="sec-title" style={{ marginTop: '32px' }}>
          {isDe ? 'Aktuelle Community-Beiträge' : 'Recent Community Contributions'} ({submissions.length})
        </h2>
        <div className="list">
          {submissions.map((item) => (
            <div key={item.id} className="row community-card">
              <span className="meta">
                {new Date(item.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                <br />
                {item.author}
              </span>
              <div>
                <h3 style={{ margin: '0 0 6px' }}>{item.title}</h3>
                <p style={{ margin: '0 0 8px', color: 'var(--ink)' }}>{item.summary}</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="community-source-link">
                    ↗ {isDe ? 'Primärquelle öffnen' : 'View Primary Source'}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
