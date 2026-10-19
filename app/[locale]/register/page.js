'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ALL_BEATS, DEFAULT_ACTIVE_TOPICS } from '@/lib/topics.mjs';

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || 'de';
  const isDe = locale === 'de';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [newsletter, setNewsletter] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState(DEFAULT_ACTIVE_TOPICS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailDetails, setEmailDetails] = useState(null);
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);

  function toggleTopic(id) {
    if (selectedTopics.includes(id)) {
      if (selectedTopics.length > 1) {
        setSelectedTopics(selectedTopics.filter((t) => t !== id));
      }
    } else {
      setSelectedTopics([...selectedTopics, id]);
    }
  }

  function selectAllTopics() {
    setSelectedTopics(ALL_BEATS.map(b => b.id));
  }

  function resetTopics() {
    setSelectedTopics(DEFAULT_ACTIVE_TOPICS);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim().replace(/^@+/, '');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUser || cleanUser.length < 3) {
      setError(isDe ? 'Bitte wähle einen Benutzernamen mit mindestens 3 Zeichen.' : 'Please choose a username with at least 3 characters.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(isDe ? 'Bitte gib eine gültige E-Mail-Adresse ein.' : 'Please provide a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError(isDe ? 'Das Passwort muss mindestens 6 Zeichen lang sein.' : 'Password must be at least 6 characters.');
      return;
    }

    if (password !== passwordConfirm) {
      setError(isDe ? 'Die eingegebenen Passwörter stimmen nicht überein.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // 1. Newsletter registration
      if (newsletter) {
        await fetch('/api/community/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            topics: selectedTopics,
            locale,
          }),
        }).catch(() => {});
      }

      // 2. Dispatch Confirmation Email via backend API
      const mailRes = await fetch('/api/auth/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          username: cleanUser,
          locale,
          topics: selectedTopics,
        }),
      });

      const mailData = await mailRes.json().catch(() => ({}));

      // 3. Save topics to cookie
      document.cookie = `plain_topics=${encodeURIComponent(JSON.stringify(selectedTopics))};path=/;max-age=31536000;samesite=lax`;

      // 4. Create Session Payload
      const sessionPayload = {
        v: 2,
        name: cleanUser,
        username: cleanUser,
        email: cleanEmail,
        provider: 'email',
        avatar: cleanUser.charAt(0).toUpperCase(),
        topics: selectedTopics,
        newsletter,
        registeredAt: new Date().toISOString(),
        verified: false,
      };

      document.cookie = `plain_session=${encodeURIComponent(JSON.stringify(sessionPayload))};path=/;max-age=2592000;samesite=lax`;

      setEmailDetails({
        email: cleanEmail,
        username: cleanUser,
        confirmUrl: mailData.confirmUrl,
        htmlPreview: mailData.htmlPreview,
        deliveryMethod: mailData.deliveryMethod,
      });

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(isDe ? 'Registrierung fehlgeschlagen. Bitte erneut versuchen.' : 'Registration failed. Please retry.');
      setLoading(false);
    }
  }

  return (
    <div className="register-page-container">
      <div className="register-card">
        <div className="register-header">
          <div className="label">{isDe ? 'PLAIN. KONTO ERSTELLEN' : 'PLAIN. CREATE ACCOUNT'}</div>
          <h1 className="register-title">{isDe ? 'Leser-Registrierung & Personalisierung' : 'Reader Registration & Personalization'}</h1>
          <p className="register-sub">
            {isDe
              ? 'Wähle deinen Benutzernamen und stelle deine persönlichen Nachrichtenthemen zusammen. 100% werbefrei und faktenbasiert.'
              : 'Choose your username and configure your personalized news beats. Completely unbiased and ad-free.'}
          </p>
        </div>

        {error && <div className="comment-moderation-alert">{error}</div>}

        {success && emailDetails ? (
          <div className="register-success-box" style={{ background: '#f8f8f6', border: '2px solid #000', padding: '28px 24px', boxShadow: '5px 5px 0 #000', marginTop: '16px' }}>
            <div className="label" style={{ color: '#16a34a' }}>✓ {isDe ? 'REGISTRIERUNG ERFOLGREICH' : 'REGISTRATION SUCCESSFUL'}</div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', margin: '8px 0 14px 0' }}>
               {isDe ? 'Bestätigungs-Mail wurde versendet' : 'Confirmation Email Sent'}
            </h2>
            <p style={{ fontSize: '14.5px', lineHeight: '1.6', marginBottom: '16px' }}>
              {isDe
                ? `Wir haben eine Bestätigungs-E-Mail an `
                : `We sent a confirmation email to `}
              <strong>{emailDetails.email}</strong>
              {isDe
                ? ` gesendet. Bitte klicke auf den Bestätigungslink in der Mail, um dein Konto zu aktivieren.`
                : `. Please click the activation link in your inbox to verify your account.`}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '24px' }}>
              {emailDetails.confirmUrl && (
                <a
                  href={emailDetails.confirmUrl}
                  className="btn btn-inv"
                  style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                  ✓ {isDe ? 'Jetzt direkt bestätigen (Aktivierungslink)' : 'Verify Now (Direct Link)'}
                </a>
              )}
              {emailDetails.htmlPreview && (
                <button
                  type="button"
                  onClick={() => setShowEmailPreviewModal(true)}
                  className="btn"
                  style={{ background: '#fff' }}
                >
                   {isDe ? 'E-Mail-Vorschau ansehen' : 'View Email Preview'}
                </button>
              )}
              <Link href={`/${locale}`} className="btn" style={{ background: '#fff' }}>
                {isDe ? 'Weiter zum Newsfeed →' : 'Continue to Feed →'}
              </Link>
            </div>

            {/* Email Preview Modal */}
            {showEmailPreviewModal && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#fff',
                    maxWidth: '640px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    border: '3px solid #000',
                    boxShadow: '8px 8px 0 #000',
                    padding: '24px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #ddd', paddingBottom: '12px' }}>
                    <span className="label"> {isDe ? 'POSTEINGANG VORSCHAU' : 'INBOX PREVIEW'}</span>
                    <button
                      type="button"
                      onClick={() => setShowEmailPreviewModal(false)}
                      style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    dangerouslySetInnerHTML={{ __html: emailDetails.htmlPreview }}
                    style={{ border: '1px solid #eee', padding: '12px' }}
                  />
                  <div style={{ marginTop: '20px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setShowEmailPreviewModal(false)}
                      className="btn btn-inv"
                    >
                      {isDe ? 'Schliessen' : 'Close'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleRegister} className="register-form">
            <div className="register-grid">
              <div className="auth-field">
                <label className="label">{isDe ? 'Benutzername / Handle*' : 'Username / Handle*'}</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  placeholder={isDe ? 'z. B. Simon_CH oder NewsFan' : 'e.g. Simon_CH'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="auth-text-input"
                />
              </div>

              <div className="auth-field">
                <label className="label">{isDe ? 'E-Mail-Adresse*' : 'Email address*'}</label>
                <input
                  type="email"
                  required
                  placeholder="name@beispiel.ch"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-text-input"
                />
              </div>

              <div className="auth-field">
                <label className="label">{isDe ? 'Passwort (mind. 6 Zeichen)*' : 'Password (min. 6 chars)*'}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-text-input"
                />
              </div>

              <div className="auth-field">
                <label className="label">{isDe ? 'Passwort bestätigen*' : 'Confirm password*'}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="auth-text-input"
                />
              </div>
            </div>

            {/* Newsletter Opt-In */}
            <div className="register-checkbox-row">
              <label className="register-checkbox-label">
                <input
                  type="checkbox"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                  className="register-checkbox"
                />
                <span>
                  <strong>{isDe ? 'Täglicher Fakten-Briefing Newsletter' : 'Daily Fact Briefing Newsletter'}</strong>
                  <br />
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {isDe
                      ? 'Erhalte morgens um 07:00 eine werbefreie Zusammenfassung der wichtigsten Welt- und Schweizer Ereignisse.'
                      : 'Receive an ad-free 7:00 AM summary of crucial Swiss and global events.'}
                  </span>
                </span>
              </label>
            </div>

            {/* Extended Beats & Topic Selection */}
            <div className="register-beats-section">
              <div className="register-beats-header">
                <div>
                  <div className="label">{isDe ? 'THEMEN-AUSWAHL (23 SCHWERPUNKTE)' : 'TOPIC SELECTION (23 BEATS)'}</div>
                  <h3 className="register-beats-title">
                    {isDe ? 'Passe deinen persönlichen Newsfeed an' : 'Customize your personalized newsfeed'}
                  </h3>
                </div>
                <div className="register-beats-actions">
                  <button type="button" onClick={selectAllTopics} className="topics-btn">
                    {isDe ? 'Alle wählen' : 'Select all'}
                  </button>
                  <button type="button" onClick={resetTopics} className="topics-btn">
                    {isDe ? 'Standard' : 'Reset'}
                  </button>
                </div>
              </div>

              <div className="register-beats-grid">
                {ALL_BEATS.map((beat) => {
                  const active = selectedTopics.includes(beat.id);
                  return (
                    <button
                      key={beat.id}
                      type="button"
                      onClick={() => toggleTopic(beat.id)}
                      className={`register-beat-chip ${active ? 'active' : ''}`}
                    >
                      <span className="register-beat-label">{isDe ? beat.labelDe : beat.labelEn}</span>
                      <span className="register-beat-check">{active ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="register-submit-row">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-inv register-submit-btn"
              >
                {loading
                  ? (isDe ? 'Registrierung & Mailversand läuft…' : 'Creating account & sending email…')
                  : (isDe ? 'Konto registrieren & Bestätigungs-Mail senden →' : 'Register & Send Confirmation Email →')}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px' }}>
                {isDe ? 'Bereits registriert? ' : 'Already registered? '}
                <Link href={`/${locale}`} style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                  {isDe ? 'Hier anmelden' : 'Log in here'}
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
