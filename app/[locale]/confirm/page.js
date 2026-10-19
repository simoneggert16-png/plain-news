'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = params?.locale || 'de';
  const isDe = locale === 'de';
  const code = searchParams.get('code');
  const authError = searchParams.get('error_description') || searchParams.get('error');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState({ username: '', email: '' });

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        if (authError) throw new Error(authError);
        const supabase = getSupabaseBrowserClient();
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user?.email_confirmed_at) {
          throw new Error(isDe
            ? 'Bestätigungslink ungültig oder abgelaufen. Bitte melde dich erneut an.'
            : 'Verification link is invalid or expired. Please sign in again.');
        }

        const user = session.user;
        const username = user.user_metadata?.username || user.email.split('@')[0];
        const userInfoCookie = {
          v: 2,
          name: username,
          username,
          email: user.email,
          provider: user.app_metadata?.provider || 'email',
          avatar: username.charAt(0).toUpperCase(),
          verified: true,
        };
        document.cookie = `plain_session=${encodeURIComponent(JSON.stringify(userInfoCookie))};path=/;max-age=2592000;samesite=lax`;
        if (Array.isArray(user.user_metadata?.topics)) {
          document.cookie = `plain_topics=${encodeURIComponent(JSON.stringify(user.user_metadata.topics))};path=/;max-age=31536000;samesite=lax`;
        }

        if (user.user_metadata?.newsletter === true) {
          const response = await fetch('/api/community/newsletter', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || 'Newsletter konnte nicht aktiviert werden.');
          }
        }

        if (active) {
          setUserInfo({ username, email: user.email });
          setSuccess(true);
        }
      } catch (err) {
        if (active) setError(err.message || (isDe ? 'Bestätigung fehlgeschlagen.' : 'Email confirmation failed.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    verify();
    return () => { active = false; };
  }, [authError, code, isDe]);

  return (
    <div className="register-page-container">
      <div className="register-card" style={{ maxWidth: '580px', margin: '40px auto' }}>
        <div className="register-header">
          <div className="label">{isDe ? 'PLAIN. KONTO-VERIFIZIERUNG' : 'PLAIN. ACCOUNT VERIFICATION'}</div>
          <h1 className="register-title">{isDe ? 'E-Mail-Bestätigung' : 'Email Confirmation'}</h1>
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
                ? `Willkommen, ${userInfo.username}! Dein Konto für ${userInfo.email} ist aktiviert.`
                : `Welcome, ${userInfo.username}! Your account for ${userInfo.email} is active.`}
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
    <Suspense fallback={<div className="register-page-container"><div className="register-card">Lade Verifizierung…</div></div>}>
      <ConfirmContent />
    </Suspense>
  );
}
