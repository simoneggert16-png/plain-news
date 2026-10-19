'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ALL_BEATS, DEFAULT_ACTIVE_TOPICS } from '@/lib/topics.mjs';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function RegisterPage() {
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

    if (!password || password.length < 8) {
      setError(isDe ? 'Das Passwort muss mindestens 8 Zeichen lang sein.' : 'Password must be at least 8 characters.');
      return;
    }

    if (password !== passwordConfirm) {
      setError(isDe ? 'Die eingegebenen Passwörter stimmen nicht überein.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/${locale}/confirm`,
          data: {
            username: cleanUser,
            newsletter,
            topics: selectedTopics,
            locale,
          },
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        document.cookie = `plain_topics=${encodeURIComponent(JSON.stringify(selectedTopics))};path=/;max-age=31536000;samesite=lax`;
      }

      setEmailDetails({ email: cleanEmail, newsletter });
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || (isDe ? 'Registrierung fehlgeschlagen. Bitte erneut versuchen.' : 'Registration failed. Please retry.'));
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
            <div className="label" style={{ color: '#16a34a' }}>✓ {isDe ? 'REGISTRIERUNG GESTARTET' : 'REGISTRATION STARTED'}</div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', margin: '8px 0 14px 0' }}>
               {isDe ? 'Bestätigungs-Mail wurde versendet' : 'Confirmation Email Sent'}
            </h2>
            <p style={{ fontSize: '14.5px', lineHeight: '1.6', marginBottom: '16px' }}>
              {isDe
                ? `Supabase sendet eine Bestätigungs-E-Mail an `
                : `A confirmation email is being sent to `}
              <strong>{emailDetails.email}</strong>
              {isDe
                ? ` . Bitte bestätige deine Adresse über den Link in der Mail.`
                : `. Please use the link in that email to verify your address.`}
              {emailDetails.newsletter && (
                <>{' '}{isDe
                  ? 'Der tägliche Newsletter wird nach der E-Mail-Bestätigung aktiviert.'
                  : 'Your daily newsletter subscription will activate after email verification.'}</>
              )}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '24px' }}>
              <Link href={`/${locale}`} className="btn" style={{ background: '#fff' }}>
                {isDe ? 'Weiter zum Newsfeed →' : 'Continue to Feed →'}
              </Link>
            </div>
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
                <label className="label">{isDe ? 'Passwort (mind. 8 Zeichen)*' : 'Password (min. 8 chars)*'}</label>
                <input
                  type="password"
                  required
                  minLength={8}
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
                  minLength={8}
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
                      ? 'Erhalte täglich ein werbefreies Briefing mit den wichtigsten Welt- und Schweizer Ereignissen.'
                      : 'Receive a daily ad-free briefing of important Swiss and global news.'}
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
