'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

function ResetPasswordForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params?.locale || 'de';
  const isDe = locale === 'de';
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const queryType = searchParams.get('type');
  const queryError = searchParams.get('error_description') || searchParams.get('error');

  const [ready, setReady] = useState(false);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [sessionEmail, setSessionEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const initPromiseRef = useRef(null);

  useEffect(() => {
    let active = true;
    let subscription;

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === 'PASSWORD_RECOVERY' && session) {
          setIsRecoveryFlow(true);
          setSessionEmail(session.user?.email || '');
          setReady(true);
          setLoading(false);
        }
      });
      subscription = data?.subscription;
    } catch {
      // Handled in prepare() below
    }

    async function runRecoveryCheck() {
      if (queryError) throw new Error(queryError);
      const supabase = getSupabaseBrowserClient();
      let recovered = false;
      let session = null;

      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        recovered = true;
        session = data?.session || null;
      } else if (tokenHash && queryType === 'recovery') {
        const { data, error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (otpError) throw otpError;
        recovered = true;
        session = data?.session || null;
      } else if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const hashError = hashParams.get('error_description') || hashParams.get('error');
        if (hashError) {
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
          throw new Error(hashError);
        }
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        if (accessToken && refreshToken && hashType === 'recovery') {
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) throw setSessionError;
          recovered = true;
          session = data?.session || null;
        }
      }

      if (!session) {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        session = data?.session || null;
      }

      if (!session) {
        throw new Error(isDe ? 'Der Reset-Link ist ungültig oder abgelaufen.' : 'This reset link is invalid or expired.');
      }

      return {
        recovered,
        email: session.user?.email || '',
      };
    }

    async function prepare() {
      try {
        if (!initPromiseRef.current) {
          initPromiseRef.current = runRecoveryCheck();
        }
        const result = await initPromiseRef.current;
        if (active) {
          if (result.recovered) setIsRecoveryFlow(true);
          setSessionEmail(result.email);
          setReady(true);
        }
      } catch (err) {
        if (active) setError(err.message || (isDe ? 'Der Reset-Link ist ungültig oder abgelaufen.' : 'This reset link is invalid or expired.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    prepare();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [code, tokenHash, queryType, queryError, isDe]);

  async function updatePassword(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');

    if (password.length < 8) {
      setError(isDe ? 'Das Passwort muss mindestens 8 Zeichen lang sein.' : 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError(isDe ? 'Die Passwörter stimmen nicht überein.' : 'Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();

      if (!isRecoveryFlow) {
        if (!currentPassword) {
          setError(isDe ? 'Bitte gib dein aktuelles Passwort zur Bestätigung ein.' : 'Please enter your current password to confirm.');
          return;
        }
        let emailToVerify = sessionEmail;
        if (!emailToVerify) {
          const { data: userData } = await supabase.auth.getUser();
          emailToVerify = userData?.user?.email || '';
        }
        if (!emailToVerify) {
          setError(isDe ? 'Konto-E-Mail konnte nicht geprüft werden. Bitte nutze den Passwort-Reset per E-Mail.' : 'Could not verify account email. Please use an email recovery link.');
          return;
        }
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: emailToVerify,
          password: currentPassword,
        });
        if (verifyError) {
          setError(isDe ? 'Das aktuelle Passwort ist nicht korrekt.' : 'Current password is incorrect.');
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(updateError.message);
      else setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="register-page-container">
      <div className="register-card" style={{ maxWidth: '580px', margin: '40px auto' }}>
        <div className="register-header">
          <div className="label">PLAIN. {isDe ? 'PASSWORT ZURÜCKSETZEN' : 'RESET PASSWORD'}</div>
          <h1 className="register-title">{isDe ? 'Neues Passwort' : 'Choose a new password'}</h1>
        </div>
        {loading && <p>{isDe ? 'Prüfe Reset-Link…' : 'Checking reset link…'}</p>}
        {!loading && !ready && error && <div className="comment-moderation-alert">{error}</div>}
        {!loading && ready && !success && (
          <form onSubmit={updatePassword} className="register-form">
            {!isRecoveryFlow && (
              <div className="auth-field">
                <label className="label">{isDe ? 'Aktuelles Passwort' : 'Current password'}</label>
                <input
                  className="auth-text-input"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
            )}
            <div className="auth-field">
              <label className="label">{isDe ? 'Neues Passwort (mind. 8 Zeichen)' : 'New password (min. 8 characters)'}</label>
              <input
                className="auth-text-input"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="auth-field">
              <label className="label">{isDe ? 'Passwort bestätigen' : 'Confirm password'}</label>
              <input
                className="auth-text-input"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
            {error && <div className="comment-moderation-alert">{error}</div>}
            <button className="btn btn-inv" type="submit" disabled={submitting}>
              {submitting ? (isDe ? 'Speichere…' : 'Saving…') : (isDe ? 'Passwort speichern' : 'Save password')}
            </button>
          </form>
        )}
        {success && (
          <div>
            <div className="comment-moderation-success">{isDe ? 'Passwort wurde aktualisiert.' : 'Password updated.'}</div>
            <Link className="btn btn-inv" href={`/${locale}`}>{isDe ? 'Zum Anmelden' : 'Sign in'}</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="register-page-container">Lade…</div>}><ResetPasswordForm /></Suspense>;
}
