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
  Easing,
} from 'remotion';

export const PlainMotionAd = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // -------------------------------------------------------------
  // COLORS & THEME (Authentic PLAIN. Swiss Brutalism)
  // -------------------------------------------------------------
  const C = {
    paper: '#eae3d2',
    paper2: '#e1d8c3',
    paper3: '#d6ccb4',
    ink: '#0d0d0b',
    ink2: '#34312a',
    muted: '#776f5f',
    accent: '#c93b2b',
    green: '#2c6a3d',
    cardBorder: '2px solid #0d0d0b',
    thickBorder: '3px solid #0d0d0b',
    hugeBorder: '6px solid #0d0d0b',
  };

  // -------------------------------------------------------------
  // TIMELINE SEGMENTS (900 frames = 30.0s @ 30fps)
  // -------------------------------------------------------------
  // Act 1: The Outrage Economy Hook (0 - 145)   [0.0s - 4.8s]
  // Act 2: The Antidote — Plain News (145 - 290) [4.8s - 9.7s]
  // Act 3: The 5 Principles (290 - 710)          [9.7s - 23.7s]
  //   - Principle 01: Zero Spin (290 - 374)
  //   - Principle 02: Two-Source Rule (374 - 458)
  //   - Principle 03: Expose the Framing (458 - 542)
  //   - Principle 04: Zero Commerce (542 - 626)
  //   - Principle 05: Adversarial AI (626 - 710)
  // Act 4: Broadsheet Authority & CTA (710 - 900)[23.7s - 30.0s]

  const isAct1 = frame < 145;
  const isAct2 = frame >= 145 && frame < 290;
  const isAct3 = frame >= 290 && frame < 710;
  const isAct4 = frame >= 710;

  // Flash transition at cut into PLAIN (frame 142 - 148)
  const cutFlash = interpolate(frame, [142, 145, 149], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // =============================================================
  // ACT 1: HOOK ANIMATIONS (0 - 145)
  // =============================================================
  const jitterX = isAct1 && frame > 60 ? Math.sin(frame * 2.8) * 9 : 0;
  const jitterY = isAct1 && frame > 60 ? Math.cos(frame * 3.4) * 7 : 0;

  const hookTitleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 140 },
  });

  const p1Spring = spring({ frame: frame - 22, fps, config: { damping: 12, stiffness: 180 } });
  const p2Spring = spring({ frame: frame - 42, fps, config: { damping: 12, stiffness: 190 } });
  const p3Spring = spring({ frame: frame - 62, fps, config: { damping: 12, stiffness: 200 } });
  const p4Spring = spring({ frame: frame - 82, fps, config: { damping: 11, stiffness: 210 } });

  const stampSpring = spring({
    frame: frame - 102,
    fps,
    config: { damping: 8, stiffness: 240 },
  });

  // =============================================================
  // ACT 2: ENTER PLAIN (145 - 290)
  // =============================================================
  const act2Frame = Math.max(0, frame - 145);

  const a2Entrance = spring({
    frame: act2Frame,
    fps,
    config: { damping: 16, stiffness: 110 },
  });

  // Buttery continuous sub-pixel scroll of the real frontpage (height 2600px)
  // Uses cubic-bezier smooth easing so EVERY frame moves by fractional pixels (true 60fps feel)
  const frontpageScrollY = interpolate(act2Frame, [25, 135], [0, -820], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  const a2BadgeSpring = spring({
    frame: act2Frame - 50,
    fps,
    config: { damping: 13, stiffness: 150 },
  });

  // =============================================================
  // ACT 3: THE 5 PRINCIPLES (290 - 710)
  // =============================================================
  const act3Frame = Math.max(0, frame - 290);

  // Active principle index (0 to 4)
  const currentPIndex = Math.min(
    4,
    Math.max(0, Math.floor(act3Frame / 84))
  );
  const pProgress = (act3Frame % 84) / 84;
  const pLocalFrame = act3Frame % 84;

  const principleCardSpring = spring({
    frame: pLocalFrame,
    fps,
    config: { damping: 14, stiffness: 170 },
  });

  // Continuous smooth vertical translation of the real Principles screenshot
  // Moving smoothly from principle 1 down to principle 5
  const principlesScrollY = interpolate(act3Frame, [0, 420], [0, -960], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  const principlesData = [
    {
      num: '01',
      title: 'ZERO SPIN.',
      body: 'Verified events, direct quotes, and hard data only. No speculation. No loaded adjectives. No narrative.',
      tag: 'NO OPINION · NO FRAMING',
      accentColor: '#0d0d0b',
    },
    {
      num: '02',
      title: 'TWO-SOURCE RULE.',
      body: 'No rumor mills. A story only exists once at least two independent newsrooms confirm it.',
      tag: 'CROSS-VERIFIED · INDEPENDENT',
      accentColor: C.accent,
    },
    {
      num: '03',
      title: 'EXPOSE THE FRAMING.',
      body: 'Original headlines from competing outlets side by side. Spin is visible at a single glance.',
      tag: 'RADICAL TRANSPARENCY',
      accentColor: '#0d0d0b',
    },
    {
      num: '04',
      title: 'ZERO COMMERCE.',
      body: '0 ads. 0 paywalls. 0 trackers. 0 subscriptions. Pure information, unconditionally open to all.',
      tag: 'FREE FOREVER · NO TRACKING',
      accentColor: C.accent,
    },
    {
      num: '05',
      title: 'ADVERSARIAL AI PIPELINE.',
      body: 'Reporter agents extract facts; a separate editor agent stress-tests every claim against primary sources.',
      tag: 'DUAL-AGENT AI NEWSROOM',
      accentColor: '#0d0d0b',
    },
  ];

  const currentPrinciple = principlesData[currentPIndex];

  // =============================================================
  // ACT 4: BROADSHEET & CLIMAX CTA (710 - 900)
  // =============================================================
  const act4Frame = Math.max(0, frame - 710);

  const broadsheetEntrance = spring({
    frame: act4Frame,
    fps,
    config: { damping: 17, stiffness: 100 },
  });

  const ctaEntrance = spring({
    frame: act4Frame - 25,
    fps,
    config: { damping: 12, stiffness: 130 },
  });

  // Continuous subtle pulse on button
  const ctaPulse = 1 + Math.sin(act4Frame * 0.16) * 0.025;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.paper,
        color: C.ink,
        fontFamily: "'Helvetica Neue', Arial, -apple-system, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* 30-Second Master Audio Track */}
      <Audio src={staticFile('audio/master_ad_30s.mp3')} volume={1} />

      {/* Global Styles */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,700;1,6..72,400&family=Inter:wght@400;700;900&family=Bebas+Neue&display=swap');
          
          * {
            box-sizing: border-box;
            border-radius: 0 !important;
          }

          .paper-bg {
            background-color: #eae3d2;
            background-image: radial-gradient(rgba(13, 13, 11, 0.045) 1px, transparent 1px);
            background-size: 24px 24px;
          }

          .brut-shadow {
            box-shadow: 10px 10px 0px #0d0d0b;
          }

          .brut-shadow-sm {
            box-shadow: 6px 6px 0px #0d0d0b;
          }

          .brut-shadow-lg {
            box-shadow: 18px 18px 0px #0d0d0b;
          }
        `}
      </style>

      {/* =========================================================== */}
      {/* ACT 1: THE TOXIC MEDIA HOOK (Frames 0 - 145 / 0.0s - 4.8s) */}
      {/* =========================================================== */}
      {isAct1 && (
        <AbsoluteFill
          style={{
            backgroundColor: '#0d0d0d',
            color: '#FFFFFF',
            padding: '70px 50px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transform: `translate(${jitterX}px, ${jitterY}px)`,
          }}
        >
          {/* Top Warning Status Bar */}
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
            <span>● REALITY CHECK: THE MODERN INTERNET</span>
            <span>01 / 04</span>
          </div>

          {/* Hard-Hitting Hook Question */}
          <div
            style={{
              opacity: hookTitleSpring,
              transform: `translateY(${interpolate(hookTitleSpring, [0, 1], [40, 0])}px)`,
              marginTop: 25,
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                fontSize: 84,
                lineHeight: 0.95,
                letterSpacing: 1.5,
                color: '#FFFFFF',
                textTransform: 'uppercase',
              }}
            >
              WHY DOES READING THE NEWS MAKE YOU FEEL{' '}
              <span style={{ color: '#ff3b30', textDecoration: 'underline' }}>
                ANXIOUS?
              </span>
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 26,
                color: '#bbbbbb',
                marginTop: 20,
                lineHeight: 1.4,
              }}
            >
              Because 94% of media doesn't want to inform you. They want your rage.
            </div>
          </div>

          {/* Simulated Toxic Media Popups */}
          <div
            style={{
              position: 'relative',
              height: 980,
              width: '100%',
              margin: '20px 0',
            }}
          >
            {/* Blurry backdrop of fake news site */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#1c1c1c',
                border: '3px solid #333',
                padding: 30,
                opacity: 0.5,
                filter: 'blur(2px)',
              }}
            >
              <div style={{ height: 40, background: '#333', marginBottom: 20 }} />
              <div style={{ height: 300, background: '#444', marginBottom: 20 }} />
              <div style={{ height: 35, background: '#2e2e2e', marginBottom: 15 }} />
              <div style={{ height: 35, background: '#2e2e2e', width: '65%' }} />
            </div>

            {/* Popup 1: Cookie Consent Blackmail */}
            {p1Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 50,
                  left: 20,
                  right: 20,
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  padding: 30,
                  border: '4px solid #000000',
                  boxShadow: '10px 10px 0px rgba(255,59,48,0.8)',
                  transform: `scale(${p1Spring}) rotate(-2deg)`,
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: '#ff3b30', fontWeight: 'bold' }}>
                  🍪 842 PARTNERS WANT TO TRACK YOUR DATA
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 10, lineHeight: 1.2 }}>
                  Accept all cookies or subscribe for $14.99 / month?
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, background: '#000', color: '#fff', padding: 14, textAlign: 'center', fontWeight: 'bold' }}>
                    ACCEPT ALL TRACKERS
                  </div>
                </div>
              </div>
            )}

            {/* Popup 2: Obscene Clickbait Banner */}
            {p2Spring > 0.05 && (
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
                  boxShadow: '12px 12px 0px #000',
                  transform: `scale(${p2Spring}) rotate(2.5deg)`,
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: '#cc0000', fontWeight: 900 }}>
                  ⚠️ BREAKING CLICKBAIT: YOU WON'T BELIEVE THIS!
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>
                  THIS ONE BIZARRE TRICK MAKES MILLIONS! (BANKS HATE HIM!)
                </div>
              </div>
            )}

            {/* Popup 3: Autoplay Video Ad */}
            {p3Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 540,
                  left: 30,
                  right: 30,
                  backgroundColor: '#ff2d55',
                  color: '#ffffff',
                  padding: 24,
                  border: '3px solid #ffffff',
                  boxShadow: '12px 12px 0px #000',
                  transform: `scale(${p3Spring}) rotate(-2deg)`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800 }}>
                    ▶ AD (0:15) · VIDEO AUTOPLAY WITH SOUND
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 'bold' }}>[X]</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
                  Casino deposit matched 500%! Hurry, bonus expires in 60 seconds!
                </div>
              </div>
            )}

            {/* Popup 4: Aggressive Paywall Wall */}
            {p4Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 720,
                  left: 15,
                  right: 15,
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  padding: 24,
                  border: '3px solid #ff4d4d',
                  boxShadow: '10px 10px 0px #ff4d4d',
                  transform: `scale(${p4Spring}) rotate(1.2deg)`,
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, color: '#ff4d4d', fontWeight: 'bold' }}>
                  🔒 PAYWALL: 0 OF 0 FREE ARTICLES REMAINING
                </div>
                <div style={{ fontSize: 22, marginTop: 6 }}>
                  Subscribe for $1 this week, then renews at $49.99/month.
                </div>
              </div>
            )}

            {/* THE RED STAMP SLAM */}
            {stampSpring > 0.1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '38%',
                  left: '4%',
                  right: '4%',
                  backgroundColor: '#c93b2b',
                  color: '#ffffff',
                  padding: '34px 20px',
                  border: '6px solid #ffffff',
                  boxShadow: '18px 18px 0px #000000',
                  textAlign: 'center',
                  transform: `scale(${stampSpring}) rotate(-6deg)`,
                  zIndex: 50,
                }}
              >
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 72, letterSpacing: 3, lineHeight: 1 }}>
                  THIS ISN'T JOURNALISM.
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 800, letterSpacing: 2, marginTop: 10 }}>
                  THIS IS DIGITAL POLLUTION.
                </div>
              </div>
            )}
          </div>

          {/* Bottom Prompt */}
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
            TIME FOR THE RADICAL ANTIDOTE ▼
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 2: ENTER PLAIN — REAL FRONTPAGE SCROLL (Frames 145 - 290) */}
      {/* =========================================================== */}
      {isAct2 && (
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
            <span>PLAIN. SWISS MODERNIST NEWS</span>
            <span style={{ color: C.accent }}>● 02 / 04</span>
          </div>

          {/* Stark Masthead Header */}
          <div
            style={{
              marginTop: 25,
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
                News without noise.
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
                gap: 15,
              }}
            >
              <span style={{ background: C.ink, color: C.paper, padding: '4px 10px' }}>
                0 ADS
              </span>
              <span style={{ background: C.ink, color: C.paper, padding: '4px 10px' }}>
                0 PAYWALL
              </span>
              <span style={{ background: C.ink, color: C.paper, padding: '4px 10px' }}>
                0 TRACKING
              </span>
              <span style={{ background: C.accent, color: '#fff', padding: '4px 10px' }}>
                100% FACTS
              </span>
            </div>
          </div>

          {/* REAL MOBILE FOOTAGE IN ACTION (Continuous Sub-Pixel Translate Scroll) */}
          <div
            style={{
              flex: 1,
              marginTop: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              opacity: a2Entrance,
              transform: `translateY(${interpolate(a2Entrance, [0, 1], [150, 0])}px)`,
            }}
          >
            {/* The Phone Bezel with brutalist hard borders */}
            <div
              className="brut-shadow-lg"
              style={{
                width: 800,
                height: 1200,
                backgroundColor: C.paper,
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
                  zIndex: 10,
                  position: 'relative',
                }}
              >
                <span>plain-news.ch</span>
                <span style={{ color: '#7fc48f' }}>● LIVE ENGLISH EDITION</span>
              </div>

              {/* REAL RECORDED FOOTAGE: Continuous 60fps Subpixel Smooth Translation */}
              <div
                style={{
                  width: '100%',
                  height: 'calc(100% - 38px)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    transform: `translate3d(0, ${frontpageScrollY}px, 0)`,
                    willChange: 'transform',
                  }}
                >
                  <Img
                    src={staticFile('footage_en/mobile_frontpage_long.png')}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Kinetic Callout Badge */}
            {a2BadgeSpring > 0.1 && (
              <div
                className="brut-shadow"
                style={{
                  position: 'absolute',
                  bottom: 30,
                  backgroundColor: C.paper,
                  border: C.thickBorder,
                  padding: '20px 30px',
                  maxWidth: 740,
                  transform: `scale(${a2BadgeSpring})`,
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
                  No algorithm. No sensationalism.
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
                  Chronological feeds · Verified source count · Read time transparency.
                </div>
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 3: THE 5 PRINCIPLES — RADICAL INTEGRITY (Frames 290 - 710) */}
      {/* =========================================================== */}
      {isAct3 && (
        <AbsoluteFill className="paper-bg" style={{ padding: '60px 45px' }}>
          {/* Top Swiss Status Header */}
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
            <span>PLAIN. OUR 5 CORE PRINCIPLES</span>
            <span style={{ color: C.accent }}>● {currentPrinciple.num} / 05</span>
          </div>

          {/* Section Masthead */}
          <div
            style={{
              marginTop: 25,
              borderBottom: '1px solid #34312a',
              paddingBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 78,
                  letterSpacing: 2,
                  lineHeight: 0.95,
                  color: C.ink,
                }}
              >
                THE ARCHITECTURE OF TRUTH.
              </div>
              <div
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 28,
                  fontStyle: 'italic',
                  color: C.muted,
                  marginTop: 6,
                }}
              >
                How we engineered a completely bias-free newsroom.
              </div>
            </div>

            {/* Principle Counter Pill */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 18,
                fontWeight: 800,
                background: C.ink,
                color: C.paper,
                padding: '6px 14px',
                letterSpacing: 1.5,
              }}
            >
              RULE {currentPrinciple.num}
            </div>
          </div>

          {/* SPLIT VIEW: Real Principles Page on Left + Kinetic Focus Card on Right */}
          <div
            style={{
              flex: 1,
              marginTop: 25,
              display: 'flex',
              gap: 30,
              position: 'relative',
              alignItems: 'stretch',
            }}
          >
            {/* LEFT: Real Mobile Principles Page Smoothly Scrolling */}
            <div
              className="brut-shadow-sm"
              style={{
                width: 440,
                backgroundColor: C.paper,
                border: C.thickBorder,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  height: 34,
                  backgroundColor: C.ink,
                  color: C.paper,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  letterSpacing: 1,
                }}
              >
                <span>plain-news.ch/en/about</span>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    width: '100%',
                    transform: `translate3d(0, ${principlesScrollY}px, 0)`,
                    willChange: 'transform',
                  }}
                >
                  <Img
                    src={staticFile('footage_en/mobile_principles_full.png')}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT: High-Impact Principle Spotlight Box */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                className="brut-shadow-lg"
                style={{
                  backgroundColor: C.paper,
                  border: C.hugeBorder,
                  padding: '40px 35px',
                  position: 'relative',
                  transform: `scale(${principleCardSpring})`,
                }}
              >
                {/* Tag pill */}
                <div
                  style={{
                    display: 'inline-block',
                    backgroundColor: currentPrinciple.accentColor,
                    color: currentPrinciple.accentColor === '#0d0d0b' ? C.paper : '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 16,
                    fontWeight: 800,
                    padding: '6px 16px',
                    letterSpacing: 1.5,
                    marginBottom: 25,
                  }}
                >
                  {currentPrinciple.tag}
                </div>

                {/* Number & Headline */}
                <div
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: 64,
                    fontWeight: 900,
                    letterSpacing: -2,
                    lineHeight: 1.05,
                    color: C.ink,
                  }}
                >
                  <span style={{ color: C.accent, marginRight: 15 }}>{currentPrinciple.num}.</span>
                  {currentPrinciple.title}
                </div>

                {/* Deep Explainer Body */}
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 26,
                    lineHeight: 1.45,
                    color: '#2a2822',
                    marginTop: 25,
                    borderTop: '2px solid #34312a',
                    paddingTop: 25,
                  }}
                >
                  {currentPrinciple.body}
                </div>

                {/* Bottom Principle Progress Bar */}
                <div
                  style={{
                    marginTop: 35,
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: 8,
                        backgroundColor:
                          idx === currentPIndex
                            ? C.accent
                            : idx < currentPIndex
                            ? C.ink
                            : 'rgba(13, 13, 11, 0.2)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 4: BROADSHEET & CLIMAX CTA (Frames 710 - 900 / 23.7s - 30.0s) */}
      {/* =========================================================== */}
      {isAct4 && (
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
            <span>PLAIN. THE INDEPENDENT NEWSROOM</span>
            <span style={{ color: C.accent }}>● 04 / 04</span>
          </div>

          {/* REAL DESKTOP BROADSHEET SHOWCASE */}
          <div
            style={{
              marginTop: 25,
              opacity: broadsheetEntrance,
              transform: `translateY(${interpolate(broadsheetEntrance, [0, 1], [40, 0])}px)`,
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
                src={staticFile('footage_en/desktop_broadsheet_en.png')}
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
              DESKTOP BROADSHEET · 100% READABILITY
            </div>
          </div>

          {/* Climax Headlines */}
          <div
            style={{
              marginTop: 35,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 88,
                letterSpacing: 3,
                lineHeight: 0.9,
                color: C.ink,
              }}
            >
              TURN OFF THE NOISE.
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
              Read the first real news of your life.
            </div>
          </div>

          {/* FINAL HIGH-CONVERTING BRUTALIST CALL-TO-ACTION CARD */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: ctaEntrance,
              transform: `scale(${ctaEntrance})`,
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
                ● 100% FREE · NO SUBSCRIPTION EVER
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
                  transform: `scale(${ctaPulse})`,
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
                OPEN DIRECTLY IN YOUR BROWSER · NO APP NEEDED
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
                9 LANGUAGES IN REAL-TIME · 100% UNBIASED & OPEN SOURCE
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
