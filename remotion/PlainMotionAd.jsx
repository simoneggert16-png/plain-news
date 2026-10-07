import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
  Img,
} from 'remotion';

export const PlainMotionAd = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // -------------------------------------------------------------
  // COLORS & THEME (Authentic PLAIN. Design System)
  // -------------------------------------------------------------
  const C = {
    paper: '#eae3d2',
    paper2: '#e1d8c3',
    paper3: '#d6ccb4',
    ink: '#0d0d0b',
    ink2: '#34312a',
    muted: '#776f5f',
    accent: '#c93b2b',
    up: '#2c6a3d',
    cardBorder: '2px solid #0d0d0b',
    thickBorder: '3px solid #0d0d0b',
  };

  // -------------------------------------------------------------
  // SCENE TIMING (420 frames = 14.0s @ 30fps)
  // -------------------------------------------------------------
  // Scene 1: Chaos Hook (0 - 85) ~ 0.0s - 2.8s
  // Scene 2: PLAIN Identity & Real Frontpage Scroll (85 - 200) ~ 2.8s - 6.7s
  // Scene 3: Real Match Center & Opta Facts (200 - 315) ~ 6.7s - 10.5s
  // Scene 4: Broadsheet & Final CTA (315 - 420) ~ 10.5s - 14.0s

  const isScene1 = frame < 85;
  const isScene2 = frame >= 85 && frame < 200;
  const isScene3 = frame >= 200 && frame < 315;
  const isScene4 = frame >= 315;

  // Global flash on cut to Scene 2 (frame 84 - 88)
  const cutFlash = interpolate(frame, [82, 85, 89], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // =============================================================
  // SCENE 1 ANIMATIONS: CHAOS MEDIA HOOK
  // =============================================================
  const jitterX = isScene1 && frame > 40 ? (Math.sin(frame * 2.5) * 8) : 0;
  const jitterY = isScene1 && frame > 40 ? (Math.cos(frame * 3.1) * 6) : 0;

  const hookTitleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 160 },
  });

  const popup1Spring = spring({
    frame: frame - 18,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const popup2Spring = spring({
    frame: frame - 32,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const popup3Spring = spring({
    frame: frame - 46,
    fps,
    config: { damping: 11, stiffness: 220 },
  });

  const stampSpring = spring({
    frame: frame - 60,
    fps,
    config: { damping: 8, stiffness: 240 },
  });

  // =============================================================
  // SCENE 2 ANIMATIONS: PLAIN REVELATION & REAL MOBILE SCROLL
  // =============================================================
  const scene2Frame = Math.max(0, frame - 85);

  const phoneEntrance = spring({
    frame: scene2Frame,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  const logoEntrance = spring({
    frame: scene2Frame - 8,
    fps,
    config: { damping: 14, stiffness: 150 },
  });

  // Animated scroll sequence index (0 to 30)
  const scrollIndex = Math.min(
    30,
    Math.max(0, Math.floor(interpolate(scene2Frame, [20, 100], [0, 30], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })))
  );
  const scrollImgSrc = staticFile(`footage/scroll_seq/scroll_${String(scrollIndex).padStart(3, '0')}.png`);

  const s2BadgeSpring = spring({
    frame: scene2Frame - 45,
    fps,
    config: { damping: 14, stiffness: 160 },
  });

  // =============================================================
  // SCENE 3 ANIMATIONS: REAL MATCH CENTER & OPTA STATS
  // =============================================================
  const scene3Frame = Math.max(0, frame - 200);

  const matchCardSpring = spring({
    frame: scene3Frame,
    fps,
    config: { damping: 15, stiffness: 130 },
  });

  const matchOverlaySpring = spring({
    frame: scene3Frame - 20,
    fps,
    config: { damping: 14, stiffness: 160 },
  });

  // =============================================================
  // SCENE 4 ANIMATIONS: BROADSHEET & CLIMAX CTA
  // =============================================================
  const scene4Frame = Math.max(0, frame - 315);

  const broadsheetSpring = spring({
    frame: scene4Frame,
    fps,
    config: { damping: 18, stiffness: 100 },
  });

  const ctaCardSpring = spring({
    frame: scene4Frame - 25,
    fps,
    config: { damping: 12, stiffness: 140 },
  });

  const pulseBtn = 1 + Math.sin(scene4Frame * 0.18) * 0.025;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.paper,
        color: C.ink,
        fontFamily: "'Helvetica Neue', Arial, -apple-system, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Audio Track */}
      <Audio src={staticFile('audio/master_ad_audio.mp3')} volume={1} />

      {/* Global CSS for Paper Texture and Styling */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,700;1,6..72,400&family=Inter:wght@400;700;900&family=Bebas+Neue&display=swap');
          
          * {
            box-sizing: border-box;
            border-radius: 0 !important;
          }

          .paper-bg {
            background-color: #eae3d2;
            background-image: radial-gradient(rgba(13, 13, 11, 0.04) 1px, transparent 1px);
            background-size: 20px 20px;
          }

          .brut-shadow {
            box-shadow: 10px 10px 0px #0d0d0b;
          }

          .brut-shadow-sm {
            box-shadow: 5px 5px 0px #0d0d0b;
          }

          .brut-shadow-lg {
            box-shadow: 18px 18px 0px #0d0d0b;
          }
        `}
      </style>

      {/* =========================================================== */}
      {/* SCENE 1: THE TOXIC MEDIA HOOK (Frames 0 - 85) */}
      {/* =========================================================== */}
      {isScene1 && (
        <AbsoluteFill
          style={{
            backgroundColor: '#121212',
            color: '#FFFFFF',
            padding: '70px 50px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transform: `translate(${jitterX}px, ${jitterY}px)`,
          }}
        >
          {/* Top Warning Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid rgba(255,255,255,0.2)',
              paddingBottom: 20,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              letterSpacing: 2,
              color: '#ff4d4d',
            }}
          >
            <span>● ACHTUNG: MEDIEN-ALLTAG</span>
            <span>01 / 04</span>
          </div>

          {/* Aggressive Hook Question */}
          <div
            style={{
              opacity: hookTitleSpring,
              transform: `translateY(${interpolate(hookTitleSpring, [0, 1], [40, 0])}px)`,
              marginTop: 30,
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                fontSize: 82,
                lineHeight: 0.95,
                letterSpacing: 1.5,
                color: '#FFFFFF',
                textTransform: 'uppercase',
              }}
            >
              WARUM BIST DU NACH DEN NACHRICHTEN IMMER{' '}
              <span style={{ color: '#ff3b30', textDecoration: 'underline' }}>
                GESTRESST?
              </span>
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 26,
                color: '#aaaaaa',
                marginTop: 20,
                lineHeight: 1.4,
              }}
            >
              Weil 94% der heutigen Medien dich nicht informieren wollen. Sie wollen deine Wut.
            </div>
          </div>

          {/* Simulated Toxic Media Popups */}
          <div
            style={{
              position: 'relative',
              height: 900,
              width: '100%',
              margin: '20px 0',
            }}
          >
            {/* Toxic Mock Device Screen Background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#1a1a1a',
                border: '3px solid #333333',
                padding: 30,
                opacity: 0.6,
                filter: 'blur(1.5px)',
              }}
            >
              <div style={{ height: 40, background: '#333', marginBottom: 20 }} />
              <div style={{ height: 260, background: '#444', marginBottom: 20 }} />
              <div style={{ height: 30, background: '#2e2e2e', marginBottom: 15 }} />
              <div style={{ height: 30, background: '#2e2e2e', width: '70%' }} />
            </div>

            {/* Popup 1: Annoying Cookie Banner */}
            {popup1Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 70,
                  left: 20,
                  right: 20,
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  padding: 30,
                  border: '3px solid #000000',
                  boxShadow: '8px 8px 0px rgba(255,59,48,0.7)',
                  transform: `scale(${popup1Spring}) rotate(-2deg)`,
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: '#ff3b30', fontWeight: 'bold' }}>
                  🍪 842 PARTNER MÖCHTEN TRACKEN
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 10, lineHeight: 1.2 }}>
                  Cookies akzeptieren oder 14,99 € / Monat zahlen?
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, background: '#000', color: '#fff', padding: 14, textAlign: 'center', fontWeight: 'bold' }}>
                    ALLES AKZEPTIEREN
                  </div>
                </div>
              </div>
            )}

            {/* Popup 2: Obscene Clickbait Banner */}
            {popup2Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 310,
                  left: 10,
                  right: 10,
                  backgroundColor: '#ffff00',
                  color: '#000000',
                  padding: 26,
                  border: '4px solid #ff0000',
                  boxShadow: '10px 10px 0px #000',
                  transform: `scale(${popup2Spring}) rotate(2.5deg)`,
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: '#cc0000', fontWeight: 900 }}>
                  ⚠️ BREAKING: SCHOCK-URTEIL!
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>
                  DIESER EINE TRICK GEGEN BAUCHFETT VERBLÜFFT DIE ÄRZTE!
                </div>
              </div>
            )}

            {/* Popup 3: Autoplay Video Ad */}
            {popup3Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 520,
                  left: 30,
                  right: 30,
                  backgroundColor: '#ff2d55',
                  color: '#ffffff',
                  padding: 24,
                  border: '3px solid #ffffff',
                  boxShadow: '12px 12px 0px #000',
                  transform: `scale(${popup3Spring}) rotate(-1.5deg)`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800 }}>
                    ▶ ANZEIGE (0:15) ÜBERSPRINGEN
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 'bold' }}>[X]</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
                  Casino-Bonus jetzt verdoppeln! Nur noch 3 Minuten gültig!
                </div>
              </div>
            )}

            {/* THE RED STAMP SLAM */}
            {stampSpring > 0.1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '42%',
                  left: '5%',
                  right: '5%',
                  backgroundColor: '#c93b2b',
                  color: '#ffffff',
                  padding: '30px 20px',
                  border: '6px solid #ffffff',
                  boxShadow: '16px 16px 0px #000000',
                  textAlign: 'center',
                  transform: `scale(${stampSpring}) rotate(-6deg)`,
                  zIndex: 50,
                }}
              >
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 68, letterSpacing: 3, lineHeight: 1 }}>
                  DAS IST KEIN JOURNALISMUS.
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, letterSpacing: 2, marginTop: 10 }}>
                  DAS IST GEISTIGER SONDERMÜLL.
                </div>
              </div>
            )}
          </div>

          {/* Bottom Callout */}
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              color: '#888888',
              textAlign: 'center',
              borderTop: '2px solid rgba(255,255,255,0.2)',
              paddingTop: 20,
              letterSpacing: 2,
            }}
          >
            ZEIT FÜR DEN RADIKALEN GEGENENTWURF ▼
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* SCENE 2: THE REVELATION & REAL MOBILE FOOTAGE (Frames 85 - 200) */}
      {/* =========================================================== */}
      {isScene2 && (
        <AbsoluteFill className="paper-bg" style={{ padding: '60px 45px' }}>
          {/* Top Swiss Ticker Bar Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: C.thickBorder,
              paddingBottom: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              color: C.ink,
            }}
          >
            <span>PLAIN. SCHWEIZER MINIMALISMUS</span>
            <span style={{ color: C.accent }}>● 02 / 04</span>
          </div>

          {/* Stark Masthead Header */}
          <div
            style={{
              marginTop: 25,
              opacity: logoEntrance,
              transform: `translateY(${interpolate(logoEntrance, [0, 1], [-25, 0])}px)`,
              borderBottom: '1px solid #34312a',
              paddingBottom: 25,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 15 }}>
              <span
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 105,
                  fontWeight: 900,
                  letterSpacing: -4,
                  lineHeight: 0.85,
                  color: C.ink,
                }}
              >
                PLAIN.
              </span>
              <span
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 34,
                  fontStyle: 'italic',
                  color: C.muted,
                }}
              >
                Nachrichten ohne Lärm.
              </span>
            </div>

            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 20,
                color: C.ink,
                fontWeight: 700,
                marginTop: 15,
                letterSpacing: 1.5,
                display: 'flex',
                gap: 20,
              }}
            >
              <span style={{ background: C.ink, color: C.paper, padding: '4px 10px' }}>
                0% WERBUNG
              </span>
              <span style={{ background: C.ink, color: C.paper, padding: '4px 10px' }}>
                0% PAYWALL
              </span>
              <span style={{ background: C.accent, color: '#fff', padding: '4px 10px' }}>
                100% FAKTEN
              </span>
            </div>
          </div>

          {/* REAL MOBILE FOOTAGE IN ACTION (Floating Device Bezel) */}
          <div
            style={{
              flex: 1,
              marginTop: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              opacity: phoneEntrance,
              transform: `translateY(${interpolate(phoneEntrance, [0, 1], [150, 0])}px)`,
            }}
          >
            {/* The Phone Bezel with brutalist hard borders */}
            <div
              className="brut-shadow-lg"
              style={{
                width: 780,
                height: 1220,
                backgroundColor: '#ffffff',
                border: '6px solid #0d0d0b',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Simulated Live Top Status */}
              <div
                style={{
                  height: 38,
                  backgroundColor: C.ink,
                  color: C.paper,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 20px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 14,
                  letterSpacing: 1,
                }}
              >
                <span>plain-news.ch</span>
                <span style={{ color: '#7fc48f' }}>● LIVE-VERBINDUNG</span>
              </div>

              {/* REAL RECORDED FOOTAGE: Butter-Smooth Scroll Through Live Website */}
              <div style={{ width: '100%', height: 'calc(100% - 38px)', overflow: 'hidden' }}>
                <Img
                  src={scrollImgSrc}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                  }}
                />
              </div>
            </div>

            {/* Kinetic Feature Callout Stamp */}
            {s2BadgeSpring > 0.1 && (
              <div
                className="brut-shadow"
                style={{
                  position: 'absolute',
                  bottom: 30,
                  backgroundColor: C.paper,
                  border: C.thickBorder,
                  padding: '20px 30px',
                  maxWidth: 720,
                  transform: `scale(${s2BadgeSpring})`,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: 32,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: C.ink,
                  }}
                >
                  Kein Algorithmus. Keine Aufreger-Überschriften.
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 18,
                    color: C.muted,
                    marginTop: 8,
                    letterSpacing: 1,
                  }}
                >
                  Verifizierte Quellenübersicht · Chronologisch sortiert · Neutral.
                </div>
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* SCENE 3: REAL MATCH CENTER & FACTUAL SPORTS (Frames 200 - 315) */}
      {/* =========================================================== */}
      {isScene3 && (
        <AbsoluteFill className="paper-bg" style={{ padding: '60px 45px' }}>
          {/* Top Swiss Ticker Bar Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: C.thickBorder,
              paddingBottom: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              color: C.ink,
            }}
          >
            <span>PLAIN. SPORT CENTER · ECHTE DATEN</span>
            <span style={{ color: C.accent }}>● 03 / 04</span>
          </div>

          {/* Section Headline */}
          <div
            style={{
              marginTop: 25,
              borderBottom: '1px solid #34312a',
              paddingBottom: 25,
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 76,
                letterSpacing: 2,
                lineHeight: 0.95,
                color: C.ink,
              }}
            >
              SPORTSTATISTIKEN OHNE EMOJI-CLOWNS.
            </div>
            <div
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontSize: 28,
                fontStyle: 'italic',
                color: C.muted,
                marginTop: 10,
              }}
            >
              Ergebnisse, Torschützen, Vorlagen, Opta-Fakten. Auf den Punkt.
            </div>
          </div>

          {/* REAL MATCH CENTER FOOTAGE IN DEVICE */}
          <div
            style={{
              flex: 1,
              marginTop: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              opacity: matchCardSpring,
              transform: `translateY(${interpolate(matchCardSpring, [0, 1], [100, 0])}px)`,
            }}
          >
            <div
              className="brut-shadow-lg"
              style={{
                width: 820,
                height: 1140,
                backgroundColor: C.paper,
                border: '6px solid #0d0d0b',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Header inside phone */}
              <div
                style={{
                  height: 42,
                  backgroundColor: C.ink,
                  color: C.paper,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 20px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 15,
                  letterSpacing: 1,
                }}
              >
                <span>MATCH-CENTER · OPTA VERIFIED</span>
                <span style={{ color: '#ff4d4d' }}>● FT 90'</span>
              </div>

              {/* REAL SCREENSHOT OF THE ACTUAL MATCH CENTER */}
              <Img
                src={staticFile('footage/mobile_matchcenter.png')}
                style={{
                  width: '100%',
                  height: 'calc(100% - 42px)',
                  objectFit: 'cover',
                  objectPosition: 'top center',
                }}
              />
            </div>

            {/* Overlaid Brutalist Specs */}
            {matchOverlaySpring > 0.1 && (
              <div
                className="brut-shadow"
                style={{
                  position: 'absolute',
                  bottom: 25,
                  backgroundColor: C.ink,
                  color: C.paper,
                  padding: '24px 30px',
                  width: 760,
                  border: '3px solid #ffffff',
                  transform: `scale(${matchOverlaySpring})`,
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: 2,
                    color: '#ff4d4d',
                  }}
                >
                  OPTA-PRÄZISION · DUAL-AGENT PIPELINE
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 20,
                    marginTop: 8,
                    lineHeight: 1.3,
                    color: '#f0ede6',
                  }}
                >
                  Automatisierte Auswertung von Toren, Assists und Taktik. Keine Clickbait-Noten, kein Gerüchte-Spam.
                </div>
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* SCENE 4: BROADSHEET AUTHORITY & FINAL CALL-TO-ACTION (Frames 315 - 420) */}
      {/* =========================================================== */}
      {isScene4 && (
        <AbsoluteFill className="paper-bg" style={{ padding: '60px 45px' }}>
          {/* Top Swiss Ticker Bar Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: C.thickBorder,
              paddingBottom: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              color: C.ink,
            }}
          >
            <span>PLAIN. DAS FINALE MANIFEST</span>
            <span style={{ color: C.accent }}>● 04 / 04</span>
          </div>

          {/* REAL DESKTOP BROADSHEET SHOWCASE */}
          <div
            style={{
              marginTop: 25,
              opacity: broadsheetSpring,
              transform: `translateY(${interpolate(broadsheetSpring, [0, 1], [40, 0])}px)`,
              position: 'relative',
            }}
          >
            <div
              className="brut-shadow-sm"
              style={{
                width: '100%',
                height: 520,
                border: C.thickBorder,
                overflow: 'hidden',
                backgroundColor: '#ffffff',
              }}
            >
              <Img
                src={staticFile('footage/desktop_frontpage_broadsheet.png')}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top center',
                }}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                top: 15,
                left: 15,
                background: C.ink,
                color: C.paper,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16,
                padding: '6px 14px',
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              BROADSHEET-ANSICHT · DIE SCHWEIZER ZEITUNG DER ZUKUNFT
            </div>
          </div>

          {/* Climax Typography */}
          <div
            style={{
              marginTop: 35,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 84,
                letterSpacing: 3,
                lineHeight: 0.9,
                color: C.ink,
              }}
            >
              SCHALTE DEN LÄRM AB.
            </div>
            <div
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontSize: 34,
                fontStyle: 'italic',
                color: C.muted,
                marginTop: 15,
              }}
            >
              Lies heute die ersten echten Nachrichten deines Lebens.
            </div>
          </div>

          {/* FINAL HIGH-CONVERTING BRUTALIST CALL-TO-ACTION BOX */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: ctaCardSpring,
              transform: `scale(${ctaCardSpring})`,
            }}
          >
            <div
              className="brut-shadow-lg"
              style={{
                width: '100%',
                backgroundColor: C.ink,
                color: C.paper,
                border: '6px solid #0d0d0b',
                padding: '50px 40px',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {/* Corner badge */}
              <div
                style={{
                  position: 'absolute',
                  top: -24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: C.accent,
                  color: '#ffffff',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 18,
                  fontWeight: 800,
                  padding: '8px 24px',
                  letterSpacing: 2,
                  border: '3px solid #0d0d0b',
                }}
              >
                ● 100% KOSTENLOS & WERBEFREI
              </div>

              <div
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 80,
                  fontWeight: 900,
                  letterSpacing: -3,
                  lineHeight: 1,
                  color: C.paper,
                }}
              >
                PLAIN.
              </div>

              <div
                style={{
                  marginTop: 30,
                  transform: `scale(${pulseBtn})`,
                  display: 'inline-block',
                }}
              >
                <div
                  style={{
                    backgroundColor: C.paper,
                    color: C.ink,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 48,
                    fontWeight: 900,
                    letterSpacing: 2,
                    padding: '20px 45px',
                    border: '4px solid #ffffff',
                    boxShadow: '8px 8px 0px rgba(255,255,255,0.4)',
                  }}
                >
                  plain-news.ch
                </div>
              </div>

              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 22,
                  color: '#b0a996',
                  marginTop: 30,
                  letterSpacing: 2,
                }}
              >
                DIREKT IM BROWSER ÖFFNEN · KEINE APP NÖTIG
              </div>

              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 18,
                  color: '#776f5f',
                  marginTop: 15,
                  letterSpacing: 1.5,
                }}
              >
                9 SPRACHEN IN ECHTZEIT · OPEN SOURCE & UNABHÄNGIG
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Global Hard Cut Flash Overlay */}
      {cutFlash > 0.01 && (
        <AbsoluteFill
          style={{
            backgroundColor: '#ffffff',
            opacity: cutFlash,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};
