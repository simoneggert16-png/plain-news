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
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  // Chatroom state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatUser, setChatUser] = useState('');
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');

  // Translation cache for submissions and chat messages: { [id]: { translated: string, showTranslated: boolean, loading: boolean } }
  const [translations, setTranslations] = useState({});

  useEffect(() => {
    let active = true;

    const loadSubmissions = () => fetch('/api/community/submissions', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Beiträge konnten nicht geladen werden.');
        return data;
      })
      .then(data => {
        if (active && Array.isArray(data.submissions)) {
          setSubmissions(data.submissions);
          setSubmissionError('');
        }
      })
      .catch(err => {
        console.warn('Failed to load server submissions:', err);
        if (active) setSubmissionError(err.message);
      });

    const loadChat = () => fetch('/api/community/chat', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Chat konnte nicht geladen werden.');
        return data;
      })
      .then(data => {
        if (active && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
          setChatError('');
        }
      })
      .catch(err => {
        console.warn('Failed to load server chat:', err);
        if (active) setChatError(err.message);
      });

    const refresh = () => {
      loadSubmissions();
      loadChat();
    };
    refresh();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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

  // Submit Community Article / Primary Source directly to server
  const handleArticleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !sourceUrl.trim() || !summary.trim() || submittingArticle) return;

    setSubmittingArticle(true);
    setSubmissionError('');
    const authorName = author.trim() || (isDe ? 'Community-Mitglied' : 'Community Contributor');

    try {
      const postRes = await fetch('/api/community/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          sourceUrl: sourceUrl.trim(),
          summary: summary.trim(),
          author: authorName,
        }),
      });

      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || (isDe ? 'Beitrag konnte nicht gespeichert werden.' : 'Contribution could not be saved.'));
      if (!Array.isArray(postData.submissions)) throw new Error(isDe ? 'Server hat keine gespeicherten Beiträge zurückgegeben.' : 'The server did not return the saved contributions.');
      setSubmissions(postData.submissions);

      setTitle('');
      setSourceUrl('');
      setSummary('');
      setAuthor('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      console.error('Article submit error:', err);
      setSubmissionError(err.message);
    } finally {
      setSubmittingArticle(false);
    }
  };

  // Submit Chatroom Message directly to server
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || sendingChat) return;

    setSendingChat(true);
    setChatError('');
    const userName = chatUser.trim() || (isDe ? 'Leser' : 'Reader');
    const messageContent = chatText.trim();

    try {
      const postRes = await fetch('/api/community/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userName,
          text: messageContent,
        }),
      });

      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || (isDe ? 'Chat-Nachricht konnte nicht gespeichert werden.' : 'Chat message could not be saved.'));
      if (!Array.isArray(postData.messages)) throw new Error(isDe ? 'Server hat keine gespeicherten Nachrichten zurückgegeben.' : 'The server did not return the saved messages.');
      setChatMessages(postData.messages);

      setChatText('');
    } catch (err) {
      console.error('Chat error:', err);
      setChatError(err.message);
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
                ? 'Das offene PLAIN-Community-Zentrum: Primärquellen einreichen und im Live-Chatroom direkt debattieren. Alle Beiträge sind serverseitig in Echtzeit synchronisiert.'
                : 'The open PLAIN community hub: Submit primary sources and engage in real-time discourse in the live chatroom.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="comments-server-badge">● Live-Sync</span>
            <span className="comments-ai-badge" style={{ fontSize: '9.5px' }}>
               Live-Übersetzung aktiv
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="community-tab-bar">
        <button
          type="button"
          onClick={() => setActiveTab('submissions')}
          className={`community-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
        >
           {isDe ? 'Community-Quellen & Beiträge' : 'Community Stories & Sources'} ({submissions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chatroom')}
          className={`community-tab-btn ${activeTab === 'chatroom' ? 'active' : ''}`}
        >
           {isDe ? 'Live Debatten-Chatroom' : 'Live Debate Chatroom'} ({chatMessages.length})
        </button>
      </div>

      {/* TAB 1: Submissions */}
      {activeTab === 'submissions' && (
        <>
          <div className="community-submit-box">
            <h2 className="sec-title">{isDe ? 'Artikel oder Primärquelle einreichen' : 'Submit Community Story or Primary Source'}</h2>
            <p className="form-subtext">
              {isDe
                ? 'Regel: Verlinke eine überprüfbare Primärquelle (Behördenmeldung, wissenschaftliches Paper, Finanzbericht).'
                : 'Requirement: Link a verifiable primary source.'}
            </p>

            <form onSubmit={handleArticleSubmit} className="community-form">
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
                <button type="submit" disabled={submittingArticle} className="btn btn-inv">
                  {submittingArticle ? (isDe ? 'Wird übermittelt…' : 'Submitting…') : (isDe ? 'Zur Veröffentlichung einreichen' : 'Submit Contribution')}
                </button>
              </div>

              {submitted && (
                <div className="submit-success-badge">
                  ✓ {isDe ? 'Erfolgreich auf dem Server veröffentlicht!' : 'Successfully published on server!'}
                </div>
              )}
              {submissionError && (
                <p role="alert" className="submit-success-badge" style={{ color: '#b42318' }}>
                  {submissionError}
                </p>
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
                    </span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 6px' }}>{item.title}</h3>
                      <p style={{ margin: '0 0 8px', color: 'var(--ink)' }}>{displaySummary}</p>
                      
                      {isShowingTranslated && (
                        <div style={{ marginBottom: '8px' }}>
                          <span className="comment-translated-tag">
                             Live-Übersetzung ({locale.toUpperCase()})
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="community-source-link">
                           {isDe ? 'Primärquelle öffnen' : 'View Primary Source'}
                        </a>

                        <button
                          type="button"
                          onClick={() => handleToggleTranslate(item.id, item.summary)}
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
                  ? 'Offener Echtzeit-Austausch. Alle Mitteilungen werden direkt serverseitig übertragen.'
                  : 'Open real-time debate synced across all readers.'}
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
                placeholder={isDe ? 'Deine Nachricht an den Chatroom…' : 'Your message to the room…'}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="input-field"
                style={{ flex: 1 }}
                maxLength={500}
              />
              <button type="submit" disabled={sendingChat || !chatText.trim()} className="btn btn-inv">
                {sendingChat ? (isDe ? 'Sende…' : 'Sending…') : (isDe ? 'Senden' : 'Send')}
              </button>
            </div>
          </form>
          {chatError && (
            <p role="alert" className="submit-success-badge" style={{ color: '#b42318' }}>
              {chatError}
            </p>
          )}

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
                      </div>
                      <span className="chat-bubble-time">
                        {new Date(msg.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="chat-bubble-text">{displayText}</p>

                    {isShowingTranslated && (
                      <span className="comment-translated-tag" style={{ marginTop: '2px', display: 'inline-block' }}>
                         Live-Übersetzung ({locale.toUpperCase()})
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
                          <span> {isDe ? 'Übersetze…' : 'Translating…'}</span>
                        ) : isShowingTranslated ? (
                          <span> {isDe ? 'Original' : 'Original'}</span>
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
        </div>
      )}
    </div>
  );
}
