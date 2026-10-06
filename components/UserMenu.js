'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function UserMenu({ locale, isDe }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if session cookie exists
    const match = document.cookie.match(/(?:^|;\s*)plain_session=([^;]+)/);
    if (match) {
      try {
        const decoded = JSON.parse(decodeURIComponent(match[1]));
        setUser(decoded);
      } catch (e) {
        setUser({ name: 'Nutzer', provider: 'session' });
      }
    }
  }, []);

  function handleLogout() {
    document.cookie = 'plain_session=;path=/;max-age=0';
    setUser(null);
    setOpen(false);
    window.location.reload();
  }

  function handleQuickLogin(provider) {
    const demoUser = {
      name: provider === 'google' ? 'Google User' : 'Apple ID User',
      provider: provider,
      email: `${provider.toLowerCase()}@user.ch`,
      avatar: provider === 'google' ? 'G' : '',
      loggedInAt: new Date().toISOString(),
    };
    document.cookie = `plain_session=${encodeURIComponent(JSON.stringify(demoUser))};path=/;max-age=2592000;samesite=lax`;
    setUser(demoUser);
    setOpen(false);
    window.location.reload();
  }

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!e.target.closest('.user-menu-wrap')) setOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="user-menu-wrap">
      {user ? (
        <button
          type="button"
          className="topbar-user-btn"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          aria-expanded={open}
        >
          <span className="user-badge-avatar">{user.avatar || '●'}</span>
          <span className="user-btn-label">{user.name.split(' ')[0]}</span>
          <span className="lang-arrow" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
      ) : (
        <button
          type="button"
          className="topbar-user-btn login-btn"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          aria-expanded={open}
        >
          <span>{isDe ? 'Anmelden' : 'Sign In'}</span>
        </button>
      )}

      {open && (
        <div className="user-dropdown-panel" role="dialog" aria-label="Benutzerkonto">
          {user ? (
            <div className="user-panel-content">
              <div className="user-panel-head">
                <strong>{user.name}</strong>
                <span className="user-provider-tag">{user.provider.toUpperCase()}</span>
              </div>
              <p className="user-panel-info">
                {isDe
                  ? 'Dein Feed ist personalisiert. Auswahl wird sicher serverseitig gespeichert.'
                  : 'Your feed is personalized. Topics stored securely.'}
              </p>
              <button type="button" className="auth-btn-action logout" onClick={handleLogout}>
                {isDe ? 'Abmelden' : 'Sign Out'}
              </button>
            </div>
          ) : (
            <div className="user-panel-content">
              <div className="user-panel-head">
                <strong>{isDe ? 'Feed personalisieren' : 'Personalize Feed'}</strong>
              </div>
              <p className="user-panel-info">
                {isDe
                  ? 'Wähle Lieblingsthemen und melde dich optional an. Funktioniert auch ohne Login.'
                  : 'Select favorite topics and sign in optionally. Also works 100% as guest.'}
              </p>
              <div className="auth-buttons-list">
                <button
                  type="button"
                  className="auth-oauth-btn google"
                  onClick={() => handleQuickLogin('google')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>{isDe ? 'Mit Google anmelden' : 'Sign in with Google'}</span>
                </button>

                <button
                  type="button"
                  className="auth-oauth-btn apple"
                  onClick={() => handleQuickLogin('apple')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.71-.93 2.73 1.01.08 2.03-.5 2.64-1.23"/>
                  </svg>
                  <span>{isDe ? 'Mit Apple anmelden' : 'Sign in with Apple'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
