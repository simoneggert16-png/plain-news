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

      // 2. Save topics to cookie
      document.cookie = `plain_topics=${encodeURIComponent(JSON.stringify(selectedTopics))};path=/;max-age=31536000;samesite=lax`;

      // 3. Create Session Payload
      const sessionPayload = {
        name: cleanUser,
        username: cleanUser,
        email: cleanEmail,
        provider: 'email',
        avatar: cleanUser.charAt(0).toUpperCase(),
        topics: selectedTopics,
        newsletter,
        registeredAt: new Date().toISOString(),
      };

      document.cookie = `plain_session=${encodeURIComponent(JSON.stringify(sessionPayload))};path=/;max-age=2592000;samesite=lax`;
      setSuccess(true);

      setTimeout(() => {
        router.push(`/${locale}`);
        window.location.href = `/${locale}`;
      }, 1000);
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
        {success && (
          <div className="comment-moderation-success">
            ✓ {isDe ? 'Konto erfolgreich erstellt! Weiterleitung zum Newsfeed…' : 'Account created! Redirecting to feed…'}
          </div>
        )}

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
              <label className="label">{isDe ? 'Passwort* (mind. 6 Zeichen)' : 'Password* (min 6 characters)'}</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-text-input"
              />
            </div>

            <div className="auth-field">
              <label className="label">{isDe ? 'Passwort wiederholen*' : 'Confirm password*'}</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="auth-text-input"
              />
            </div>
          </div>

          <label className="auth-checkbox-label" style={{ margin: '14px 0' }}>
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
              className="auth-checkbox"
            />
            <span>
              <strong>{isDe ? 'PLAIN Daily Briefing Newsletter abonnieren' : 'Subscribe to PLAIN Daily Briefing'}</strong>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                {isDe
                  ? 'Erhalte jeden Morgen um 06:00 Uhr die wichtigsten, faktengeprüften Primärnachrichten zu deinen gewählten Themen direkt per Mail.'
                  : 'Receive the daily fact-checked morning briefing on your selected topics.'}
              </div>
            </span>
          </label>

          {/* ONBOARDING TOPIC SELECTION */}
          <div className="register-topics-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <strong className="label">{isDe ? 'ERWEITERTE THEMENAUSWAHL FÜR DEINEN HOMEFEED' : 'PERSONALIZE YOUR FEED TOPICS'}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  {isDe ? `${selectedTopics.length} von ${ALL_BEATS.length} Themen aktiv` : `${selectedTopics.length} of ${ALL_BEATS.length} beats active`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={selectAllTopics} className="pill-btn">
                  {isDe ? 'Alle wählen' : 'Select all'}
                </button>
                <button type="button" onClick={resetTopics} className="pill-btn">
                  {isDe ? 'Standard' : 'Default'}
                </button>
              </div>
            </div>

            <div className="topics-chip-grid">
              {ALL_BEATS.map((beat) => {
                const isSelected = selectedTopics.includes(beat.id);
                return (
                  <button
                    key={beat.id}
                    type="button"
                    onClick={() => toggleTopic(beat.id)}
                    className={`topic-chip ${isSelected ? 'active' : ''}`}
                    title={beat.cat}
                  >
                    <span>{beat.icon}</span>
                    <span className="chip-indicator">{isSelected ? '✓' : '+'}</span>
                    <span>{isDe ? beat.labelDe : beat.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={loading} className="btn btn-inv" style={{ padding: '12px 24px', fontSize: '13px' }}>
              {loading ? (isDe ? 'Erstelle Konto…' : 'Creating account…') : (isDe ? 'Konto registrieren & Personalisieren' : 'Create Account & Personalize')}
            </button>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {isDe ? 'Bereits registriert?' : 'Already have an account?'} <Link href={`/${locale}`} style={{ textDecoration: 'underline', color: 'var(--ink)' }}>{isDe ? 'Zum Login' : 'Sign In'}</Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
