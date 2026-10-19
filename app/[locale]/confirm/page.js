'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = params?.locale || 'de';
  const isDe = locale === 'de';

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState({ username: '', email: '' });

  useEffect(() => {
    if (!token) {
      setError(isDe ? 'Kein Bestätigungs-Token gefunden.' : 'No verification token provided.');
      setLoading(false);
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email || '')}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setSuccess(true);
          setUserInfo({
            username: data.username || 'Leser',
            email: data.email || email,
          });

          // Update cookie if session exists
          try {
            const rawSession = document.cookie
              .split('; ')
              .find((row) => row.startsWith('plain_session='));
            if (rawSession) {
              const sessionVal = JSON.parse(decodeURIComponent(rawSession.split('=')[1]));
              sessionVal.verified = true;
              sessionVal.verifiedAt = new Date().toISOString();
              document.cookie = `plain_session=${encodeURIComponent(JSON.stringify(sessionVal))};path=/;max-age=2592000;samesite=lax`;
            }
          } catch {}
        } else {
          setError(data.error || (isDe ? 'Bestätigungslink ungültig oder abgelaufen.' : 'Verification link is invalid or expired.'));
        }
      } catch (err) {
        setError(isDe ? 'Netzwerkfehler bei der Bestätigung.' : 'Network error during verification.');
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [token, email, isDe]);

  return (
    <div className="register-page-container">
      <div className="register-card" style={{ maxWidth: '580px', margin: '40px auto' }}>
        <div className="register-header">
          <div className="label">{isDe ? 'PLAIN. KONTO-VERIFIZIERUNG' : 'PLAIN. ACCOUNT VERIFICATION'}</div>
          <h1 className="register-title">
            {isDe ? 'E-Mail-Bestätigung' : 'Email Confirmation'}
          </h1>
        </div>

        {loading && (
          <div style={{ padding: '30px 0', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--muted)' }}>
               {isDe ? 'Bestätige E-Mail-Adresse und schalte Konto frei…' : 'Verifying email address and activating account…'}
            </p>
          </div>
        )}

        {!loading && success && (
          <div>
            <div className="comment-moderation-success" style={{ fontSize: '14px', padding: '16px 20px', marginBottom: '24px' }}>
              <strong>✓ {isDe ? 'E-Mail-Adresse erfolgreich bestätigt!' : 'Email successfully verified!'}</strong>
            </div>

            <p style={{ fontSize: '14.5px', lineHeight: '1.6', marginBottom: '20px' }}>
              {isDe
                ? `Willkommen, ${userInfo.username || 'Leser'}! Dein PLAIN-Konto für ${userInfo.email || email} wurde erfolgreich verifiziert. Du hast jetzt vollen Zugriff auf personalisierte Themen, Community-Debatten und dein Notizbuch.`
                : `Welcome, ${userInfo.username || 'Reader'}! Your PLAIN account for ${userInfo.email || email} is now verified. You now have full access to personalized feeds, reader debates, and your research notebook.`}
            </p>

            <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
              <Link href={`/${locale}`} className="btn btn-inv" style={{ flex: 1, textAlign: 'center', padding: '12px 20px' }}>
                {isDe ? 'Zum Newsfeed →' : 'Go to Feed →'}
              </Link>
              <Link href={`/${locale}/saved`} className="btn" style={{ flex: 1, textAlign: 'center', padding: '12px 20px' }}>
                {isDe ? 'Gespeicherte Notizen' : 'Saved Notebook'}
              </Link>
            </div>
          </div>
        )}

        {!loading && error && (
          <div>
            <div className="comment-moderation-alert" style={{ fontSize: '14px', padding: '16px 20px', marginBottom: '24px' }}>
              <strong>✕ {error}</strong>
            </div>

            <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '20px', color: 'var(--muted)' }}>
              {isDe
                ? 'Der Link ist möglicherweise abgelaufen oder wurde bereits verwendet. Du kannst dich jederzeit neu registrieren oder einloggen.'
                : 'The link might have expired or been used already. You can register again or log in at any time.'}
            </p>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <Link href={`/${locale}/register`} className="btn btn-inv" style={{ flex: 1, textAlign: 'center' }}>
                {isDe ? 'Zur Registrierung' : 'Back to Register'}
              </Link>
              <Link href={`/${locale}`} className="btn" style={{ flex: 1, textAlign: 'center' }}>
                {isDe ? 'Startseite' : 'Home'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="register-page-container">
        <div className="register-card" style={{ maxWidth: '580px', margin: '40px auto', textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--muted)' }}>
            Lade Verifizierung…
          </p>
        </div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
