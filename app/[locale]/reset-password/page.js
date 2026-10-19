'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

function ResetPasswordForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params?.locale || 'de';
  const isDe = locale === 'de';
  const code = searchParams.get('code');
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function prepare() {
      try {
        const supabase = getSupabaseBrowserClient();
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error(isDe ? 'Der Reset-Link ist ungültig oder abgelaufen.' : 'This reset link is invalid or expired.');
        if (active) setReady(true);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    prepare();
    return () => { active = false; };
  }, [code, isDe]);

  async function updatePassword(event) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(isDe ? 'Das Passwort muss mindestens 8 Zeichen lang sein.' : 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError(isDe ? 'Die Passwörter stimmen nicht überein.' : 'Passwords do not match.');
      return;
    }
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else setSuccess(true);
  }

  return (
    <div className="register-page-container">
      <div className="register-card" style={{ maxWidth: '580px', margin: '40px auto' }}>
        <div className="register-header">
          <div className="label">PLAIN. {isDe ? 'PASSWORT ZURÜCKSETZEN' : 'RESET PASSWORD'}</div>
          <h1 className="register-title">{isDe ? 'Neues Passwort' : 'Choose a new password'}</h1>
        </div>
        {loading && <p>{isDe ? 'Prüfe Reset-Link…' : 'Checking reset link…'}</p>}
        {!loading && error && <div className="comment-moderation-alert">{error}</div>}
        {!loading && ready && !success && (
          <form onSubmit={updatePassword} className="register-form">
            <div className="auth-field">
              <label className="label">{isDe ? 'Neues Passwort (mind. 8 Zeichen)' : 'New password (min. 8 characters)'}</label>
              <input className="auth-text-input" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="auth-field">
              <label className="label">{isDe ? 'Passwort bestätigen' : 'Confirm password'}</label>
              <input className="auth-text-input" type="password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </div>
            {error && <div className="comment-moderation-alert">{error}</div>}
            <button className="btn btn-inv" type="submit">{isDe ? 'Passwort speichern' : 'Save password'}</button>
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
