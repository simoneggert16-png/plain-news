'use client';
import { useState, useEffect } from 'react';

export default function CommunitySubmitSection({ locale, isDe }) {
  // Navigation tabs: 'submissions' (Quellen & Beiträge) or 'chatroom' (Live-Chat & Debatte)
  const [activeTab, setActiveTab] = useState('submissions');

  // Community articles state
  const [submissions, setSubmissions] = useState([]);
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [author, setAuthor] = useState('');
  const [submittingArticle, setSubmittingArticle] = useState(false);
  const [articleModError, setArticleModError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Chatroom state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatUser, setChatUser] = useState('');
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatModError, setChatModError] = useState(null);

  // Translation cache for submissions and chat messages: { [id]: { translated: string, showTranslated: boolean, loading: boolean } }
  const [translations, setTranslations] = useState({});

  useEffect(() => {
    // 1. Load community submissions
    try {
      const savedArticles = localStorage.getItem('plain_community_articles');
      if (savedArticles) {
        setSubmissions(JSON.parse(savedArticles));
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
          {
            id: 'comm-2',
            title: isDe
              ? 'SNB Devisenreserven: Quartalsübersicht zu Fremdwährungsbeständen'
              : 'SNB Foreign Reserves: Q3 Foreign Exchange Allocation Breakdown',
            sourceUrl: 'https://www.snb.ch',
            summary: isDe
              ? 'Die Schweizerische Nationalbank hat die aktualisierte Zusammensetzung der Währungsreserven publiziert. Der Anteil an Euro- und US-Dollar-Anleihen bleibt stabil.'
              : 'The Swiss National Bank published its updated quarterly asset allocation of foreign reserves.',
            author: 'Elena R. (Finanzanalystin)',
            date: new Date(Date.now() - 3600000 * 12).toISOString(),
          }
        ]);
      }
    } catch {
      // fallback
    }

    // 2. Load chatroom messages
    try {
      const savedChat = localStorage.getItem('plain_community_chat');
      if (savedChat) {
        setChatMessages(JSON.parse(savedChat));
      } else {
        setChatMessages([
          {
            id: 'chat-1',
            user: 'Sébastien (Lausanne)',
            text: 'Les nouvelles données du CERN confirment la stabilité des expériences sur les neutrinos sans anomalies.',
            date: new Date(Date.now() - 3600000 * 1).toISOString(),
            verified: true,
          },
          {
            id: 'chat-2',
            user: 'Lukas B. (Basel)',
            text: 'Interessante Entwicklung bei den Schweizer Exportzahlen für Pharmazeutika im letzten Monat.',
            date: new Date(Date.now() - 3600000 * 2).toISOString(),
            verified: true,
          },
          {
            id: 'chat-3',
            user: 'Andrea (Lugano)',
            text: 'Grazie per aver verificato le fonti primarie dei documenti federali. Questo approccio è unico.',
            date: new Date(Date.now() - 3600000 * 3).toISOString(),
            verified: true,
          }
        ]);
      }
    } catch {
      // fallback
    }
  }, [isDe]);

  // Translate handler (used for both submissions and chat messages)
  const handleToggleTranslate = async (id, textToTranslate) => {
    const current = translations[id];

    if (current?.translated) {
      setTranslations((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          showTranslated: !prev[id].showTranslated,
        },
      }));
      return;
    }

    setTranslations((prev) => ({
      ...prev,
      [id]: { translated: '', showTranslated: false, loading: true },
    }));

    try {
      const res = await fetch('/api/community/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          targetLocale: locale || 'de',
        }),
      });

      const data = await res.json();
      setTranslations((prev) => ({
        ...prev,
        [id]: {
          translated: data.translatedText || textToTranslate,
          showTranslated: true,
          loading: false,
        },
      }));
    } catch (err) {
      console.error('Translation error:', err);
      setTranslations((prev) => ({
        ...prev,
        [id]: { translated: textToTranslate, showTranslated: false, loading: false, error: true },
      }));
    }
  };

  // Submit Community Article / Primary Source with NVIDIA AI Moderation
  const handleArticleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !sourceUrl.trim() || !summary.trim() || submittingArticle) return;

    setSubmittingArticle(true);
    setArticleModError(null);

    const fullContent = `${title.trim()}\n\n${summary.trim()}`;
    const authorName = author.trim() || (isDe ? 'Community-Mitglied' : 'Community Contributor');

    try {
      // Call NVIDIA NIM AI Content Moderation
      const res = await fetch('/api/community/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullContent,
          author: authorName,
          type: 'community_post',
          locale: locale || 'de',
        }),
      });

      const modResult = await res.json();

      if (!modResult.approved) {
        setArticleModError(modResult.reason || (isDe
          ? 'Der Beitrag wurde von der NVIDIA AI-Moderation wegen unpassenden Inhalts oder Vulgärsprache abgelehnt.'
          : 'Submission rejected by NVIDIA AI moderation due to inappropriate content or offensive language.'));
        setSubmittingArticle(false);
        return;
      }

      const newSub = {
        id: 'comm-' + Date.now(),
        title: title.trim(),
        sourceUrl: sourceUrl.trim(),
        summary: summary.trim(),
        author: authorName,
        date: new Date().toISOString(),
        verified: true,
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
    } catch (err) {
      console.error('Article submit moderation error:', err);
      setArticleModError(isDe ? 'Prüfung fehlgeschlagen. Bitte erneut versuchen.' : 'Verification failed. Please retry.');
    } finally {
      setSubmittingArticle(false);
    }
  };

  // Submit Chatroom Message with NVIDIA AI Moderation
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || sendingChat) return;

    setSendingChat(true);
    setChatModError(null);

    const userName = chatUser.trim() || (isDe ? 'Leser' : 'Reader');
    const messageContent = chatText.trim();

    try {
      // Call NVIDIA NIM AI Content Moderation
      const res = await fetch('/api/community/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: messageContent,
          author: userName,
          type: 'chat_message',
          locale: locale || 'de',
        }),
      });

      const modResult = await res.json();

      if (!modResult.approved) {
        setChatModError(modResult.reason || (isDe
          ? 'Nachricht von NVIDIA AI abgelehnt: Unpassende Sprache, Beleidigungen oder Spam erkannt.'
          : 'Message rejected by NVIDIA AI: Inappropriate language, insults, or spam detected.'));
        setSendingChat(false);
        return;
      }

      const newMsg = {
        id: 'chat-' + Date.now(),
        user: userName,
        text: messageContent,
        date: new Date().toISOString(),
        verified: true,
      };

      const updated = [newMsg, ...chatMessages];
      setChatMessages(updated);
      try {
        localStorage.setItem('plain_community_chat', JSON.stringify(updated));
      } catch {
        // ignore
      }

      setChatText('');
    } catch (err) {
      console.error('Chat moderation error:', err);
      setChatModError(isDe ? 'Prüfung fehlgeschlagen. Bitte versuche es erneut.' : 'Verification failed. Please retry.');
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="community-container">
      <div className="community-intro">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p className="lead-dek" style={{ margin: 0 }}>
              {isDe
                ? 'Das offene PLAIN-Community-Zentrum: Primärquellen einreichen und im moderierten Live-Chatroom sachlich debattieren.'
                : 'The open PLAIN community hub: Submit primary sources and engage in moderated discourse in the live chatroom.'}
            </p>
          </div>
          <span className="comments-ai-badge" style={{ alignSelf: 'center' }}>
            <span className="ai-dot"></span> NVIDIA NIM AI Moderation & Live-Übersetzung aktiv
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="community-tab-bar">
        <button
          type="button"
          onClick={() => setActiveTab('submissions')}
          className={`community-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
        >
          📄 {isDe ? 'Community-Quellen & Beiträge' : 'Community Stories & Sources'} ({submissions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chatroom')}
          className={`community-tab-btn ${activeTab === 'chatroom' ? 'active' : ''}`}
        >
          💬 {isDe ? 'Live Debatten-Chatroom' : 'Live Debate Chatroom'} ({chatMessages.length})
        </button>
      </div>

      {/* TAB 1: Submissions */}
      {activeTab === 'submissions' && (
        <>
          <div className="community-submit-box">
            <h2 className="sec-title">{isDe ? 'Artikel oder Primärquelle einreichen' : 'Submit Community Story or Primary Source'}</h2>
            <p className="form-subtext">
              {isDe
                ? 'Regel: Verlinke eine überprüfbare Primärquelle (Behördenmeldung, wissenschaftliches Paper, Finanzbericht). Alle Einreichungen werden in Echtzeit von der NVIDIA AI auf Vulgärsprache und Spam gescannt.'
                : 'Requirement: Link a verifiable primary source. All submissions are vetted in real time by NVIDIA NIM AI against vulgarity, hostility, and spam.'}
            </p>

            <form onSubmit={handleArticleSubmit} className="community-form">
              <div className="form-grid">
                <input
                  type="text"
                  required
                  placeholder={isDe ? 'Titel / Schlagzeile des Beitrags*' : 'Article headline / title*'}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (articleModError) setArticleModError(null);
                  }}
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
                onChange={(e) => {
                  setSummary(e.target.value);
                  if (articleModError) setArticleModError(null);
                }}
                className="input-textarea"
              />

              {articleModError && (
                <div className="comment-moderation-alert">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-body">
                    <strong>{isDe ? 'Einreichung abgelehnt' : 'Submission Rejected'}:</strong> {articleModError}
                    <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.85 }}>
                      {isDe ? 'Beitrag muss sachlich und frei von Beleidigungen oder Spam sein.' : 'Contribution must remain factual and free from profanity or promotions.'}
                    </div>
                  </div>
                </div>
              )}

              <div className="form-footer-row">
                <input
                  type="text"
                  placeholder={isDe ? 'Dein Name / Alias (optional)' : 'Your name / handle (optional)'}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="input-field-compact"
                />
                <button type="submit" disabled={submittingArticle} className="btn btn-inv">
                  {submittingArticle ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span className="spinner-dots"></span> {isDe ? 'NVIDIA AI Prüfung…' : 'AI Verifying…'}
                    </span>
                  ) : (
                    isDe ? 'Zur Veröffentlichung einreichen' : 'Submit Contribution'
                  )}
                </button>
              </div>

              {submitted && (
                <div className="submit-success-badge">
                  ✓ {isDe ? 'NVIDIA AI Prüfung bestanden – Erfolgreich veröffentlicht!' : 'NVIDIA AI verification passed – Successfully published!'}
                </div>
              )}
            </form>
          </div>

          <div className="community-submissions-list">
            <h2 className="sec-title" style={{ marginTop: '32px' }}>
              {isDe ? 'Aktuelle Community-Beiträge' : 'Recent Community Contributions'} ({submissions.length})
            </h2>
            <div className="list">
              {submissions.map((item) => {
                const trans = translations[item.id];
                const isShowingTranslated = trans?.showTranslated && trans?.translated;
                const displaySummary = isShowingTranslated ? trans.translated : item.summary;

                return (
                  <div key={item.id} className="row community-card">
                    <span className="meta">
                      {new Date(item.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      <br />
                      <strong>{item.author}</strong>
                      <br />
                      <span className="comment-ai-verified" style={{ display: 'inline-block', marginTop: '4px' }}>
                        ✓ AI-geprüft
                      </span>
                    </span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 6px' }}>{item.title}</h3>
                      <p style={{ margin: '0 0 8px', color: 'var(--ink)' }}>{displaySummary}</p>
                      
                      {isShowingTranslated && (
                        <div style={{ marginBottom: '8px' }}>
                          <span className="comment-translated-tag">
                            🌐 NVIDIA AI Live-Übersetzung ({locale.toUpperCase()})
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="community-source-link">
                          ↗ {isDe ? 'Primärquelle öffnen' : 'View Primary Source'}
                        </a>

                        <button
                          type="button"
                          onClick={() => handleToggleTranslate(item.id, item.summary)}
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
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: Live Debatten-Chatroom */}
      {activeTab === 'chatroom' && (
        <div className="community-chatroom-container">
          <div className="chatroom-header-box">
            <div>
              <h2 className="sec-title" style={{ margin: 0 }}>
                {isDe ? 'PLAIN Live-Debatten Chatroom' : 'PLAIN Live Debate Chatroom'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                {isDe
                  ? 'Offener, moderierter Echtzeit-Austausch. Alle Mitteilungen werden vor der Übertragung von NVIDIA AI gescannt.'
                  : 'Open, moderated real-time debate. All messages are scanned by NVIDIA AI prior to broadcast.'}
              </p>
            </div>
            <span className="chat-live-pulse">● LIVE</span>
          </div>

          {/* Chat Post Input */}
          <form onSubmit={handleChatSubmit} className="chatroom-form">
            <div className="chatroom-input-row">
              <input
                type="text"
                placeholder={isDe ? 'Dein Name / Handle' : 'Your handle'}
                value={chatUser}
                onChange={(e) => setChatUser(e.target.value)}
                className="input-field-compact"
                style={{ maxWidth: '180px' }}
                maxLength={40}
              />
              <input
                type="text"
                required
                placeholder={isDe ? 'Deine Nachricht an den Chatroom (sachlich, keine Vulgärsprache)…' : 'Your message to the room (factual, respectful)…'}
                value={chatText}
                onChange={(e) => {
                  setChatText(e.target.value);
                  if (chatModError) setChatModError(null);
                }}
                className="input-field"
                style={{ flex: 1 }}
                maxLength={500}
              />
              <button type="submit" disabled={sendingChat || !chatText.trim()} className="btn btn-inv">
                {sendingChat ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span className="spinner-dots"></span> {isDe ? 'Prüfung…' : 'Scanning…'}
                  </span>
                ) : (
                  isDe ? 'Senden' : 'Send'
                )}
              </button>
            </div>

            {chatModError && (
              <div className="comment-moderation-alert" style={{ marginTop: '10px' }}>
                <span className="alert-icon">⚠️</span>
                <div className="alert-body">
                  <strong>{isDe ? 'Nachricht abgewiesen' : 'Message Rejected'}:</strong> {chatModError}
                </div>
              </div>
            )}
          </form>

          {/* Chat Messages Stream */}
          <div className="chatroom-stream">
            {chatMessages.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: 'var(--muted)', textAlign: 'center', padding: '30px' }}>
                {isDe ? 'Noch keine Chat-Nachrichten vorhanden. Eröffne die Debatte!' : 'No chat messages yet. Start the discussion!'}
              </p>
            ) : (
              chatMessages.map((msg) => {
                const trans = translations[msg.id];
                const isShowingTranslated = trans?.showTranslated && trans?.translated;
                const displayText = isShowingTranslated ? trans.translated : msg.text;

                return (
                  <div key={msg.id} className="chat-bubble-card">
                    <div className="chat-bubble-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="chat-bubble-author">{msg.user}</span>
                        <span className="comment-ai-verified" title={isDe ? 'Geprüft durch NVIDIA AI Moderation' : 'Verified by NVIDIA AI'}>
                          ✓ AI-geprüft
                        </span>
                      </div>
                      <span className="chat-bubble-time">
                        {new Date(msg.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="chat-bubble-text">{displayText}</p>

                    {isShowingTranslated && (
                      <span className="comment-translated-tag" style={{ marginTop: '2px', display: 'inline-block' }}>
                        🌐 NVIDIA AI Live-Übersetzung ({locale.toUpperCase()})
                      </span>
                    )}

                    <div className="chat-bubble-actions">
                      <button
                        type="button"
                        onClick={() => handleToggleTranslate(msg.id, msg.text)}
                        disabled={trans?.loading}
                        className="comment-translate-btn"
                        style={{ fontSize: '11px', padding: '2px 6px' }}
                      >
                        {trans?.loading ? (
                          <span>⏳ {isDe ? 'Übersetze…' : 'Translating…'}</span>
                        ) : isShowingTranslated ? (
                          <span>↩ {isDe ? 'Original' : 'Original'}</span>
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
        </div>
      )}
    </div>
  );
}
