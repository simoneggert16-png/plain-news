'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ALL_BEATS, DEFAULT_ACTIVE_TOPICS } from '@/lib/topics.mjs';

// 7 Curated Swiss Palettes
const PALETTES = [
  { id: 'default', name: 'Schweizer Papier', desc: 'Klassischer Zeitungsdruck', bg: '#eae3d2', ink: '#0d0d0b', accent: '#0d0d0b' },
  { id: 'swiss-red', name: 'Schweizer Rot', desc: 'Eidgenössisches Rot & Helvetica', bg: '#f4eee2', ink: '#11100e', accent: '#c5221f' },
  { id: 'dark-mono', name: 'Nacht / OLED', desc: 'Reiner Schweizer Dark Mode', bg: '#121211', ink: '#f0eee9', accent: '#34d399' },
  { id: 'alpine-blue', name: 'Alpin Klarblau', desc: 'Gletscher & Bergseen', bg: '#e5ecee', ink: '#0c1a24', accent: '#0284c7' },
  { id: 'emerald-finance', name: 'Smaragd / Banken', desc: 'Zürcher Finanzplatz & ESG', bg: '#e5ede7', ink: '#0a1f13', accent: '#059669' },
  { id: 'terminal-amber', name: 'Bernstein / Terminal', desc: 'Bloomberg & Reuters Phosphor', bg: '#16130c', ink: '#f59e0b', accent: '#f59e0b' },
  { id: 'sepia-print', name: 'Warm Sepia', desc: 'Historischer Bleisatz & NZZ-Stil', bg: '#f6efe1', ink: '#2b1f13', accent: '#7c6249' },
];

export default function UserMenu({ locale, isDe }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [modalView, setModalView] = useState('auth'); // 'auth' | 'customization' | 'forgot_password'
  const [authSubTab, setAuthSubTab] = useState('email'); // 'email' | 'oauth'

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [notice, setNotice] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Customization states
  const [palette, setPalette] = useState('default');
  const [fontSize, setFontSize] = useState('normal'); // 'compact' | 'normal' | 'large'
  const [fontFamily, setFontFamily] = useState('sans'); // 'sans' | 'serif' | 'mono'
  const [lineHeight, setLineHeight] = useState('normal'); // 'compact' | 'normal' | 'relaxed'
  const [highContrast, setHighContrast] = useState(false);
  const [textOnlyMode, setTextOnlyMode] = useState(false);
  const [activeTopics, setActiveTopics] = useState(DEFAULT_ACTIVE_TOPICS);
  const [tickerSound, setTickerSound] = useState(false);

  // Initialize from cookies / localStorage
  useEffect(() => {
    // 1. Session check
    try {
      const match = document.cookie.match(/(?:^|;\s*)plain_session=([^;]+)/);
      if (match) {
        const decoded = JSON.parse(decodeURIComponent(match[1]));
        if (!decoded.v || decoded.v < 2) {
          // Clean fresh start: wipe legacy test session
          document.cookie = 'plain_session=;path=/;max-age=0';
          setUser(null);
        } else {
          setUser(decoded);
          if (decoded.name) setUsernameInput(decoded.name);
        }
      }
    } catch (e) {}

    // 2. Count saved articles
    try {
      const storedSaved = localStorage.getItem('plain_saved_articles');
      if (storedSaved) {
        const list = JSON.parse(storedSaved);
        if (Array.isArray(list)) setSavedCount(list.length);
      }
    } catch (e) {}

    // 3. Load Palette
    try {
      const savedPalette = localStorage.getItem('plain_palette') || 'default';
      setPalette(savedPalette);
      document.documentElement.setAttribute('data-palette', savedPalette);
    } catch (e) {}

    // 4. Load Font Size & Family
    try {
      const savedSize = localStorage.getItem('plain_font_size') || 'normal';
      setFontSize(savedSize);
      document.documentElement.setAttribute('data-font-size', savedSize);

      const savedFont = localStorage.getItem('plain_font_family') || 'sans';
      setFontFamily(savedFont);
      document.documentElement.setAttribute('data-font-family', savedFont);

      const savedLH = localStorage.getItem('plain_line_height') || 'normal';
      setLineHeight(savedLH);
      document.documentElement.setAttribute('data-line-height', savedLH);

      if (localStorage.getItem('plain_high_contrast') === 'true') {
        setHighContrast(true);
        document.documentElement.setAttribute('data-contrast', 'high');
      }

      if (localStorage.getItem('plain_text_only') === 'true') {
        setTextOnlyMode(true);
        document.documentElement.setAttribute('data-text-only', 'true');
      }
    } catch (e) {}

    // 5. Load Topics
    try {
      const matchTopics = document.cookie.match(/(?:^|;\s*)plain_topics=([^;]+)/);
      if (matchTopics) {
        const parsed = JSON.parse(decodeURIComponent(matchTopics[1]));
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveTopics(parsed);
        }
      }
    } catch (e) {}

    // 6. Load Ticker Sound
    try {
      if (localStorage.getItem('plain_ticker_sound') === 'true') setTickerSound(true);
    } catch (e) {}
  }, []);

  function handleLogout() {
    document.cookie = 'plain_session=;path=/;max-age=0';
    setUser(null);
    setOpen(false);
    window.location.reload();
  }

  function handleDeleteAccount() {
    if (window.confirm(isDe ? 'Möchtest du dein Konto wirklich unwiderruflich löschen?' : 'Do you really want to permanently delete your account?')) {
      document.cookie = 'plain_session=;path=/;max-age=0';
      try {
        localStorage.removeItem('plain_saved_articles');
        localStorage.removeItem('plain_notes');
      } catch (e) {}
      setUser(null);
      setOpen(false);
      window.location.reload();
    }
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setNotice(isDe ? 'Bitte eine gültige E-Mail-Adresse eingeben' : 'Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      setNotice(isDe ? 'Passwort ist erforderlich (mindestens 6 Zeichen)!' : 'Password is required (minimum 6 characters)!');
      return;
    }

    setLoadingAuth(true);
    setNotice('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanUser = usernameInput.trim() || cleanEmail.split('@')[0];

      if (newsletterOptIn) {
        await fetch('/api/community/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            topics: activeTopics,
            locale: locale || 'de',
          }),
        }).catch(() => {});
      }

      const sessionPayload = {
        v: 2,
        name: cleanUser,
        username: cleanUser,
        email: cleanEmail,
        provider: 'email',
        newsletter: newsletterOptIn,
        avatar: cleanUser.charAt(0).toUpperCase(),
        loggedInAt: new Date().toISOString(),
      };

      document.cookie = `plain_session=${encodeURIComponent(JSON.stringify(sessionPayload))};path=/;max-age=2592000;samesite=lax`;
      setUser(sessionPayload);
      setNotice(isDe ? 'Erfolgreich angemeldet!' : 'Signed in successfully!');

      setTimeout(() => {
        setOpen(false);
        window.location.reload();
      }, 400);
    } catch (err) {
      setNotice(isDe ? 'Anmeldung fehlgeschlagen.' : 'Login failed.');
    } finally {
      setLoadingAuth(false);
    }
  }

  function handleUpdateUsername(e) {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    const clean = usernameInput.trim();
    const updated = { ...user, name: clean, username: clean, avatar: clean.charAt(0).toUpperCase() };
    document.cookie = `plain_session=${encodeURIComponent(JSON.stringify(updated))};path=/;max-age=2592000;samesite=lax`;
    setUser(updated);
    setNotice(isDe ? 'Benutzername aktualisiert!' : 'Username updated!');
    setTimeout(() => setNotice(''), 2500);
  }

  function handleOAuth(provider) {
    if (provider === 'google') {
      window.location.href = '/api/auth/google';
      return;
    }
    const sessionPayload = {
      name: 'Apple Nutzer',
      username: 'apple_user',
      email: 'apple@user.ch',
      provider: 'apple',
      avatar: '',
      loggedInAt: new Date().toISOString(),
    };
    document.cookie = `plain_session=${encodeURIComponent(JSON.stringify(sessionPayload))};path=/;max-age=2592000;samesite=lax`;
    setUser(sessionPayload);
    setOpen(false);
    window.location.reload();
  }

  function handleForgotPassword(e) {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) return;
    setForgotSuccess(true);
  }

  // Palette change
  function applyPalette(palId) {
    setPalette(palId);
    document.documentElement.setAttribute('data-palette', palId);
    try {
      localStorage.setItem('plain_palette', palId);
      document.cookie = `plain_palette=${palId};path=/;max-age=31536000;samesite=lax`;
    } catch (e) {}
  }

  // Font Size change
  function applyFontSize(size) {
    setFontSize(size);
    document.documentElement.setAttribute('data-font-size', size);
    try {
      localStorage.setItem('plain_font_size', size);
      document.cookie = `plain_font_size=${size};path=/;max-age=31536000;samesite=lax`;
    } catch (e) {}
  }

  // Font Family change
  function applyFontFamily(font) {
    setFontFamily(font);
    document.documentElement.setAttribute('data-font-family', font);
    try {
      localStorage.setItem('plain_font_family', font);
      document.cookie = `plain_font_family=${font};path=/;max-age=31536000;samesite=lax`;
    } catch (e) {}
  }

  // Line Height change
  function applyLineHeight(lh) {
    setLineHeight(lh);
    document.documentElement.setAttribute('data-line-height', lh);
    try {
      localStorage.setItem('plain_line_height', lh);
    } catch (e) {}
  }

  // Contrast toggle
  function toggleContrast() {
    const next = !highContrast;
    setHighContrast(next);
    document.documentElement.setAttribute('data-contrast', next ? 'high' : 'normal');
    try {
      localStorage.setItem('plain_high_contrast', String(next));
    } catch (e) {}
  }

  // Text-only mode toggle
  function toggleTextOnly() {
    const next = !textOnlyMode;
    setTextOnlyMode(next);
    document.documentElement.setAttribute('data-text-only', String(next));
    try {
      localStorage.setItem('plain_text_only', String(next));
    } catch (e) {}
  }

  // Topic toggle
  function toggleTopic(topicId) {
    const updated = activeTopics.includes(topicId)
      ? (activeTopics.length > 1 ? activeTopics.filter(t => t !== topicId) : activeTopics)
      : [...activeTopics, topicId];

    setActiveTopics(updated);
    try {
      document.cookie = `plain_topics=${encodeURIComponent(JSON.stringify(updated))};path=/;max-age=31536000;samesite=lax`;
    } catch (e) {}
  }

  // Ticker Sound toggle
  function toggleTickerSound() {
    const next = !tickerSound;
    setTickerSound(next);
    try {
      localStorage.setItem('plain_ticker_sound', String(next));
    } catch (e) {}
  }

  // Close when clicking outside
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
          {user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('/')) ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="user-badge-avatar"
              referrerPolicy="no-referrer"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <span className="user-badge-avatar">{user.avatar || user.name?.charAt(0) || '●'}</span>
          )}
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>{isDe ? 'Konto & Design' : 'Account & Design'}</span>
        </button>
      )}

      {open && (
        <div className="user-dropdown-panel user-dropdown-expanded" role="dialog" aria-label="Benutzerkonto und Einstellungen">
          
          {/* Main Top Switcher: Account vs Customization */}
          <div className="user-panel-top-nav">
            <button
              type="button"
              className={`panel-nav-tab ${modalView === 'customization' ? 'active' : ''}`}
              onClick={() => setModalView('customization')}
            >
               {isDe ? 'Design & Themen' : 'Design & Topics'}
            </button>
            <button
              type="button"
              className={`panel-nav-tab ${modalView === 'auth' || modalView === 'forgot_password' ? 'active' : ''}`}
              onClick={() => setModalView('auth')}
            >
               {user ? (isDe ? 'Mein Profil' : 'My Profile') : (isDe ? 'Anmelden' : 'Sign In')}
            </button>
          </div>

          {/* Quick Shortcuts Bar: Saved Articles & Notes */}
          <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--rule-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link
              href={`/${locale}/saved`}
              onClick={() => setOpen(false)}
              className="pill-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            >
              <span> {isDe ? 'Gespeicherte Artikel & Notizen' : 'Saved Stories & Notes'}</span>
              <span className="custom-active-tag" style={{ padding: '0 4px', fontSize: '9px' }}>{savedCount}</span>
            </Link>

            {!user && (
              <Link
                href={`/${locale}/register`}
                onClick={() => setOpen(false)}
                style={{ fontSize: '11px', fontFamily: 'var(--mono)', textDecoration: 'underline', color: 'var(--ink)' }}
              >
                {isDe ? 'Registrieren →' : 'Register →'}
              </Link>
            )}
          </div>

          {/* VIEW 1: CUSTOMIZATION (Available to Everyone) */}
          {modalView === 'customization' && (
            <div className="user-panel-content customization-scroll-area">
              
              {/* 1. Color Palette Picker */}
              <div className="custom-section">
                <div className="custom-section-head">
                  <strong className="label">{isDe ? 'FARBPALETTE & THEMA' : 'COLOR PALETTE & THEME'}</strong>
                  <span className="custom-active-tag">{PALETTES.find(p => p.id === palette)?.name}</span>
                </div>
                <div className="palette-grid">
                  {PALETTES.map((p) => {
                    const isSelected = palette === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPalette(p.id)}
                        className={`palette-card ${isSelected ? 'selected' : ''}`}
                        title={p.desc}
                      >
                        <div className="palette-swatch" style={{ background: p.bg, borderColor: p.accent }}>
                          <span style={{ color: p.ink, fontWeight: 700 }}>P.</span>
                          <span className="swatch-accent" style={{ background: p.accent }}></span>
                        </div>
                        <span className="palette-name">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Extended Topics Selection (Full 23 Beats) */}
              <div className="custom-section">
                <div className="custom-section-head">
                  <strong className="label">{isDe ? 'ERWEITERTE THEMENAUSWAHL' : 'EXTENDED TOPIC SELECTION'}</strong>
                  <span className="custom-active-tag">{activeTopics.length} / {ALL_BEATS.length} {isDe ? 'Aktiv' : 'Active'}</span>
                </div>
                <p className="custom-hint">
                  {isDe
                    ? 'Wähle spezifische Beats (z. B. Fussball, Formel 1, SNB, KI, Alpen). Dein persönlicher Homefeed passt sich sofort an.'
                    : 'Toggle granular beats to shape your personal feed.'}
                </p>
                <div className="topics-chip-grid">
                  {ALL_BEATS.map((topic) => {
                    const isActive = activeTopics.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        className={`topic-chip ${isActive ? 'active' : ''}`}
                      >
                        <span className="chip-indicator">{isActive ? '✓' : '+'}</span>
                        <span>{isDe ? topic.labelDe : topic.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Typography & Reading Options */}
              <div className="custom-section">
                <strong className="label" style={{ display: 'block', marginBottom: '8px' }}>
                  {isDe ? 'TYPOGRAFIE & LESESTIL' : 'TYPOGRAPHY & READING'}
                </strong>
                
                <div className="custom-row-options">
                  <span className="option-label">{isDe ? 'Schriftart:' : 'Font:'}</span>
                  <div className="option-pill-group">
                    <button
                      type="button"
                      className={`pill-btn ${fontFamily === 'sans' ? 'active' : ''}`}
                      onClick={() => applyFontFamily('sans')}
                    >
                      Sans (Inter)
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${fontFamily === 'serif' ? 'active' : ''}`}
                      onClick={() => applyFontFamily('serif')}
                    >
                      Serif (Buchdruck)
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${fontFamily === 'mono' ? 'active' : ''}`}
                      onClick={() => applyFontFamily('mono')}
                    >
                      Mono (Wire)
                    </button>
                  </div>
                </div>

                <div className="custom-row-options" style={{ marginTop: '8px' }}>
                  <span className="option-label">{isDe ? 'Textgröße:' : 'Size:'}</span>
                  <div className="option-pill-group">
                    <button
                      type="button"
                      className={`pill-btn ${fontSize === 'compact' ? 'active' : ''}`}
                      onClick={() => applyFontSize('compact')}
                    >
                      {isDe ? 'Kompakt' : 'Compact'}
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${fontSize === 'normal' ? 'active' : ''}`}
                      onClick={() => applyFontSize('normal')}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${fontSize === 'large' ? 'active' : ''}`}
                      onClick={() => applyFontSize('large')}
                    >
                      {isDe ? 'Gross' : 'Large'}
                    </button>
                  </div>
                </div>

                <div className="custom-row-options" style={{ marginTop: '8px' }}>
                  <span className="option-label">{isDe ? 'Zeilenabstand:' : 'Line height:'}</span>
                  <div className="option-pill-group">
                    <button
                      type="button"
                      className={`pill-btn ${lineHeight === 'compact' ? 'active' : ''}`}
                      onClick={() => applyLineHeight('compact')}
                    >
                      {isDe ? 'Dicht' : 'Tight'}
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${lineHeight === 'normal' ? 'active' : ''}`}
                      onClick={() => applyLineHeight('normal')}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${lineHeight === 'relaxed' ? 'active' : ''}`}
                      onClick={() => applyLineHeight('relaxed')}
                    >
                      {isDe ? 'Entspannt' : 'Relaxed'}
                    </button>
                  </div>
                </div>

                {/* Additional Toggles */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={toggleContrast}
                    className={`pill-btn ${highContrast ? 'active' : ''}`}
                  >
                    {highContrast ? ' ' + (isDe ? 'Maximal-Kontrast AN' : 'High Contrast ON') : (isDe ? 'Maximal-Kontrast' : 'High Contrast')}
                  </button>

                  <button
                    type="button"
                    onClick={toggleTextOnly}
                    className={`pill-btn ${textOnlyMode ? 'active' : ''}`}
                  >
                    {textOnlyMode ? ' ' + (isDe ? 'Nur-Text-Modus AN' : 'Text-Only ON') : (isDe ? 'Nur-Text (Keine Bilder)' : 'Text-Only')}
                  </button>

                  <button
                    type="button"
                    onClick={toggleTickerSound}
                    className={`pill-btn ${tickerSound ? 'active' : ''}`}
                  >
                    {tickerSound ? ' ' + (isDe ? 'Ticker-Audio AN' : 'Ticker Audio ON') : ' ' + (isDe ? 'Ticker Stumm' : 'Ticker Mute')}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 2: AUTH / PROFILE */}
          {modalView === 'auth' && (
            <div className="user-panel-content">
              {user ? (
                <div>
                  <div className="user-panel-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      {user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('/')) ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="user-badge-avatar"
                          style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="user-badge-avatar" style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                          {user.avatar || user.name?.charAt(0) || '●'}
                        </span>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          @{user.username || user.name}
                        </strong>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {user.email || 'Angemeldet'}
                        </div>
                      </div>
                    </div>
                    <span className="user-provider-tag">{user.provider.toUpperCase()}</span>
                  </div>

                  {/* Edit Username Feature */}
                  <form onSubmit={handleUpdateUsername} style={{ margin: '10px 0', display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder={isDe ? 'Benutzername / Handle ändern' : 'Change handle'}
                      className="auth-text-input"
                      style={{ fontSize: '11px', padding: '5px 8px' }}
                    />
                    <button type="submit" className="pill-btn">
                      {isDe ? 'Speichern' : 'Save'}
                    </button>
                  </form>

                  {notice && <div className="auth-notice">{notice}</div>}

                  <div className="user-panel-status-block">
                    <span className="label" style={{ fontSize: '9px', display: 'block', marginBottom: '3px' }}>
                      {isDe ? 'KONTO & SYNCHRONISATION' : 'ACCOUNT & SYNC'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--up)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '9px' }}>●</span> {isDe ? 'Serverseitig aktiv (Kommentare & Quellen)' : 'Synced across devices'}
                    </span>
                  </div>

                  <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                    <Link
                      href={`/${locale}/saved`}
                      onClick={() => setOpen(false)}
                      className="auth-btn-action"
                      style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
                    >
                       {isDe ? 'Gemerkte Artikel' : 'Saved Articles'}
                    </Link>
                    <button
                      type="button"
                      className="auth-btn-action logout"
                      onClick={handleLogout}
                      style={{ flex: 1 }}
                    >
                      {isDe ? 'Abmelden' : 'Sign Out'}
                    </button>
                    <button
                      type="button"
                      className="auth-btn-action"
                      onClick={handleDeleteAccount}
                      style={{ flex: 1, color: '#dc2626', borderColor: '#fca5a5' }}
                      title={isDe ? 'Konto und alle Daten unwiderruflich löschen' : 'Permanently delete account'}
                    >
                       {isDe ? 'Konto löschen' : 'Delete Account'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="user-panel-head">
                    <strong>{isDe ? 'PLAIN. Anmelden' : 'PLAIN. Sign In'}</strong>
                    <span className="label" style={{ fontSize: '9px' }}>SERVERSIDE</span>
                  </div>

                  {/* Sub-tabs: Email vs OAuth (Username completely removed!) */}
                  <div className="auth-tab-row">
                    <button
                      type="button"
                      className={`auth-tab-btn ${authSubTab === 'email' ? 'active' : ''}`}
                      onClick={() => setAuthSubTab('email')}
                    >
                       E-Mail & Passwort
                    </button>
                    <button
                      type="button"
                      className={`auth-tab-btn ${authSubTab === 'oauth' ? 'active' : ''}`}
                      onClick={() => setAuthSubTab('oauth')}
                    >
                       1-Klick OAuth
                    </button>
                  </div>

                  {notice && <div className="auth-notice">{notice}</div>}

                  {authSubTab === 'email' ? (
                    <form onSubmit={handleEmailAuth} className="auth-form-body">
                      <div className="auth-field">
                        <label className="label">
                          {isDe ? 'E-Mail-Adresse*' : 'Email address*'}
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@beispiel.ch"
                          className="auth-text-input"
                          autoFocus
                        />
                      </div>

                      <div className="auth-field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <label className="label">
                            {isDe ? 'Passwort*' : 'Password*'}
                          </label>
                          <button
                            type="button"
                            onClick={() => setModalView('forgot_password')}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '10.5px', fontFamily: 'var(--mono)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            {isDe ? 'Passwort vergessen?' : 'Forgot password?'}
                          </button>
                        </div>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="auth-text-input"
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                        <button
                          type="submit"
                          disabled={loadingAuth || !email.trim() || !password || password.length < 6}
                          className="auth-btn-action primary"
                          style={{ flex: 1, margin: 0 }}
                        >
                          {loadingAuth ? (isDe ? 'Prüfe…' : 'Signing in…') : (isDe ? 'Jetzt Einloggen' : 'Sign In')}
                        </button>
                      </div>

                      <div style={{ marginTop: '12px', textAlign: 'center', borderTop: '1px solid var(--rule-color)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {isDe ? 'Neu bei PLAIN?' : 'New to PLAIN?'}{' '}
                          <Link
                            href={`/${locale}/register`}
                            onClick={() => setOpen(false)}
                            style={{ fontWeight: 700, textDecoration: 'underline', color: 'var(--ink)' }}
                          >
                            {isDe ? 'Hier registrieren & Themen wählen →' : 'Register here →'}
                          </Link>
                        </span>
                      </div>
                    </form>
                  ) : (
                    <div className="auth-buttons-list">
                      <p className="user-panel-info">
                        {isDe
                          ? '1-Klick-Anmeldung über bestehendes Konto:'
                          : 'Instant 1-click sign-in:'}
                      </p>
                      <button
                        type="button"
                        className="auth-oauth-btn google"
                        onClick={() => handleOAuth('google')}
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
                        onClick={() => handleOAuth('apple')}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.71-.93 2.73 1.01.08 2.03-.5 2.64-1.23"/>
                        </svg>
                        <span>{isDe ? 'Mit Apple anmelden' : 'Sign in with Apple'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: FORGOT PASSWORD */}
          {modalView === 'forgot_password' && (
            <div className="user-panel-content">
              <div className="user-panel-head">
                <strong>{isDe ? 'Passwort zurücksetzen' : 'Reset Password'}</strong>
                <button
                  type="button"
                  onClick={() => setModalView('auth')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '11px' }}
                >
                  ← {isDe ? 'Zurück' : 'Back'}
                </button>
              </div>

              {forgotSuccess ? (
                <div style={{ padding: '8px 0' }}>
                  <div className="comment-moderation-success">
                    ✓ {isDe
                      ? `Sicherheitslink an ${forgotEmail} versendet! Bitte prüfe dein Postfach.`
                      : `Reset instructions sent to ${forgotEmail}!`
                    }
                  </div>
                  <button
                    type="button"
                    onClick={() => { setForgotSuccess(false); setModalView('auth'); }}
                    className="auth-btn-action primary"
                    style={{ marginTop: '12px' }}
                  >
                    {isDe ? 'Zurück zum Login' : 'Back to Login'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="auth-form-body">
                  <p style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: '1.4', margin: 0 }}>
                    {isDe
                      ? 'Gib deine registrierte E-Mail-Adresse ein. Wir senden dir unverzüglich einen gesicherten Link zur Passwort-Erneuerung.'
                      : 'Enter your registered email address to receive password reset instructions.'}
                  </p>
                  <div className="auth-field">
                    <label className="label">{isDe ? 'E-Mail-Adresse*' : 'Email address*'}</label>
                    <input
                      type="email"
                      required
                      placeholder="name@beispiel.ch"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="auth-text-input"
                      autoFocus
                    />
                  </div>
                  <button type="submit" className="auth-btn-action primary">
                    {isDe ? 'Reset-Link anfordern' : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
