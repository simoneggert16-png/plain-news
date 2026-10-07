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
    border: '3px solid #0d0d0b',
    heavyBorder: '6px solid #0d0d0b',
  };

  // -------------------------------------------------------------
  // TIMELINE SEGMENTS (900 frames = 30.0s @ 30fps)
  // -------------------------------------------------------------
  // Act 1: The Outrage Economy Hook (0 - 140)       [0.0s - 4.7s]
  // Act 2: Enter PLAIN — Real Frontpage (140 - 280)  [4.7s - 9.3s]
  // Act 3: The 5 Core Principles (280 - 720)         [9.3s - 24.0s]
  //   - P1: Zero Spin (280 - 368)
  //   - P2: Two-Source Rule (368 - 456)
  //   - P3: Expose the Framing (456 - 544)
  //   - P4: Zero Commerce (544 - 632)
  //   - P5: Adversarial AI Pipeline (632 - 720)
  // Act 4: Broadsheet Authority & Climax CTA (720 - 900) [24.0s - 30.0s]

  const isAct1 = frame < 140;
  const isAct2 = frame >= 140 && frame < 280;
  const isAct3 = frame >= 280 && frame < 720;
  const isAct4 = frame >= 720;

  // Flash transition at cut into PLAIN (frame 137 - 144)
  const cutFlash = interpolate(frame, [137, 140, 145], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // =============================================================
  // ACT 1: ENHANCED HOOK ANIMATIONS (0 - 140)
  // =============================================================
  const jitterIntensity = isAct1 && frame > 40 ? interpolate(frame, [40, 135], [2, 16]) : 0;
  const jitterX = Math.sin(frame * 3.3) * jitterIntensity;
  const jitterY = Math.cos(frame * 3.9) * jitterIntensity;

  // Kinetic Hook Text
  const hookPhase1 = spring({ frame, fps, config: { damping: 13, stiffness: 150 } });
  const hookPhase2 = spring({ frame: frame - 25, fps, config: { damping: 13, stiffness: 160 } });

  // Popups popping in on phone
  const p1Spring = spring({ frame: frame - 28, fps, config: { damping: 10, stiffness: 220 } });
  const p2Spring = spring({ frame: frame - 48, fps, config: { damping: 10, stiffness: 220 } });
  const p3Spring = spring({ frame: frame - 68, fps, config: { damping: 10, stiffness: 230 } });
  const p4Spring = spring({ frame: frame - 86, fps, config: { damping: 9, stiffness: 240 } });
  const pushNotif = spring({ frame: frame - 18, fps, config: { damping: 12, stiffness: 190 } });

  // Stamp Slam
  const stampSpring = spring({
    frame: frame - 102,
    fps,
    config: { damping: 7, stiffness: 260 },
  });

  // =============================================================
  // ACT 2: ENTER PLAIN — REAL FRONTPAGE (140 - 280)
  // =============================================================
  const act2Frame = Math.max(0, frame - 140);

  const a2Entrance = spring({
    frame: act2Frame,
    fps,
    config: { damping: 16, stiffness: 110 },
  });

  // Continuous sub-pixel scroll through the real 2600px tall English frontpage
  const frontpageScrollY = interpolate(act2Frame, [20, 130], [0, -820], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 0.05, 0.2, 1),
  });

  const a2BadgeSpring = spring({
    frame: act2Frame - 35,
    fps,
    config: { damping: 13, stiffness: 160 },
  });

  // =============================================================
  // ACT 3: THE 5 PRINCIPLES — FULLSCREEN SWISS COMPOSITION (280 - 720)
  // =============================================================
  const act3Frame = Math.max(0, frame - 280);

  // Exact 88 frames per principle (5 x 88 = 440 frames)
  const currentPIndex = Math.min(4, Math.max(0, Math.floor(act3Frame / 88)));
  const pLocalFrame = act3Frame % 88;

  const cardEntranceSpring = spring({
    frame: pLocalFrame,
    fps,
    config: { damping: 14, stiffness: 160 },
  });

  const visualEntranceSpring = spring({
    frame: pLocalFrame - 12,
    fps,
    config: { damping: 13, stiffness: 170 },
  });

  const principlesList = [
    {
      num: '01',
      title: 'ZERO SPIN',
      subtitle: 'VERIFIED PRIMARY DATA ONLY',
      dek: 'No speculation. No loaded adjectives. No narrative framing. Pure verified events, hard numbers, and direct quotes.',
      tag: 'PRINCIPLE 01 / 05',
      renderVisual: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              backgroundColor: '#fff',
              border: C.border,
              padding: '22px 24px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 20,
              boxShadow: '6px 6px 0px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ color: C.muted, fontSize: 14, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>
              STANDARD OUTLET (BIASED SENSATIONALISM)
            </div>
            <div style={{ color: C.accent, textDecoration: 'line-through', fontWeight: 'bold', lineHeight: 1.3 }}>
              "Disastrous bill sparks furious civil backlash as democracy collapses in chaos!"
            </div>
          </div>
          <div
            style={{
              backgroundColor: C.paper,
              border: '4px solid #0d0d0b',
              padding: '22px 24px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 21,
              boxShadow: '8px 8px 0px #0d0d0b',
            }}
          >
            <div style={{ color: C.green, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6 }}>
              PLAIN. (RADICAL OBJECTIVITY)
            </div>
            <div style={{ color: C.ink, fontWeight: 800, lineHeight: 1.3 }}>
              "Senate approves infrastructure bill 51 to 49 following 8-hour committee session."
            </div>
          </div>
        </div>
      ),
    },
    {
      num: '02',
      title: 'TWO-SOURCE RULE',
      subtitle: 'ZERO RUMORS TOLERATED',
      dek: 'A story does not exist until at least two independent, established global newsrooms confirm the underlying facts.',
      tag: 'PRINCIPLE 02 / 05',
      renderVisual: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div
              style={{
                flex: 1,
                backgroundColor: '#fff',
                border: C.border,
                padding: '26px 20px',
                textAlign: 'center',
                boxShadow: '6px 6px 0px #0d0d0b',
              }}
            >
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.muted }}>PRIMARY WIRE</div>
              <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 32, fontWeight: 900, marginTop: 8 }}>
                REUTERS
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: C.green, marginTop: 8, fontWeight: 'bold' }}>
                ✓ INDEPENDENTLY CONFIRMED
              </div>
            </div>
            <div
              style={{
                flex: 1,
                backgroundColor: '#fff',
                border: C.border,
                padding: '26px 20px',
                textAlign: 'center',
                boxShadow: '6px 6px 0px #0d0d0b',
              }}
            >
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.muted }}>SECONDARY WIRE</div>
              <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 32, fontWeight: 900, marginTop: 8 }}>
                AP NEWS
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: C.green, marginTop: 8, fontWeight: 'bold' }}>
                ✓ PRIMARY DATA MATCHED
              </div>
            </div>
          </div>
          <div
            style={{
              backgroundColor: C.ink,
              color: C.paper,
              padding: '16px',
              textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 1.5,
              border: '2px solid #fff',
            }}
          >
            ● AUTOMATIC AUDIT: VERIFIED FOR IMMEDIATE PUBLICATION
          </div>
        </div>
      ),
    },
    {
      num: '03',
      title: 'EXPOSE THE FRAMING',
      subtitle: 'SIDE-BY-SIDE TRANSPARENCY',
      dek: 'We extract and place competing headlines next to each other. Media spin and partisan manipulation become visible at a glance.',
      tag: 'PRINCIPLE 03 / 05',
      renderVisual: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              backgroundColor: '#fff',
              border: C.border,
              padding: '16px 22px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 18,
              borderLeft: '10px solid #0055ff',
            }}
          >
            <span style={{ fontSize: 13, color: C.muted, display: 'block', fontWeight: 700 }}>LEFT LEANING OUTLET:</span>
            <span style={{ fontWeight: 700 }}>"Historic progressive victory transforms the entire economic landscape"</span>
          </div>
          <div
            style={{
              backgroundColor: '#fff',
              border: C.border,
              padding: '16px 22px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 18,
              borderLeft: '10px solid #ff2200',
            }}
          >
            <span style={{ fontSize: 13, color: C.muted, display: 'block', fontWeight: 700 }}>RIGHT LEANING OUTLET:</span>
            <span style={{ fontWeight: 700 }}>"Reckless government spending package threatens national debt crisis"</span>
          </div>
          <div
            style={{
              backgroundColor: C.paper,
              border: C.border,
              padding: '16px 20px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 17,
              fontWeight: 900,
              color: C.ink,
              textAlign: 'center',
              boxShadow: '6px 6px 0px #0d0d0b',
            }}
          >
            PLAIN REVEALS THE SPIN BEFORE YOU READ THE FIRST WORD.
          </div>
        </div>
      ),
    },
    {
      num: '04',
      title: 'ZERO COMMERCE',
      subtitle: 'NO ADS · NO PAYWALLS · NO TRACKERS',
      dek: '0 subscriptions. 0 sponsor popups. 0 behavioral tracking. Pure unmonetized information, unconditionally open and free forever.',
      tag: 'PRINCIPLE 04 / 05',
      renderVisual: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            {['0 ADVERTISEMENTS', '0 PAYWALLS', '0 TRACKING COOKIES', '0 SUBSCRIPTIONS'].map((item) => (
              <div
                key={item}
                style={{
                  backgroundColor: C.ink,
                  color: C.paper,
                  border: '3px solid #0d0d0b',
                  padding: '28px 16px',
                  textAlign: 'center',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  boxShadow: '6px 6px 0px rgba(201,59,43,0.7)',
                }}
              >
                {item}
              </div>
            ))}
          </div>
          <div
            style={{
              backgroundColor: C.paper2,
              border: '2px dashed #0d0d0b',
              padding: '14px 20px',
              textAlign: 'center',
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 21,
              fontStyle: 'italic',
              color: C.ink,
            }}
          >
            "Information is a public utility, not an attention slot machine." — Founded by Simon Eggert
          </div>
        </div>
      ),
    },
    {
      num: '05',
      title: 'ADVERSARIAL AI AUDIT',
      subtitle: 'REPORTER + ADVERSARIAL EDITOR',
      dek: 'Reporter agents extract raw facts; a separate independent editor agent ruthlessly cross-examines every sentence against primary sources.',
      tag: 'PRINCIPLE 05 / 05',
      renderVisual: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fff',
              border: C.border,
              padding: '20px 24px',
              boxShadow: '6px 6px 0px #0d0d0b',
            }}
          >
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.muted, fontWeight: 700 }}>
                STAGE 1: FACT EXTRACTION
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 900 }}>
                DeepSeek v4.1 Flash Agent
              </div>
            </div>
            <div style={{ background: C.ink, color: C.paper, padding: '6px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 800 }}>
              REPORTER
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fff',
              border: C.border,
              padding: '20px 24px',
              boxShadow: '6px 6px 0px #0d0d0b',
            }}
          >
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.muted, fontWeight: 700 }}>
                STAGE 2: ADVERSARIAL CROSS-EXAMINATION
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 24, fontWeight: 900 }}>
                MiniMax M3 Editor Agent
              </div>
            </div>
            <div style={{ background: C.accent, color: '#fff', padding: '6px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 800 }}>
              EDITOR
            </div>
          </div>
        </div>
      ),
    },
  ];

  const p = principlesList[currentPIndex];

  // =============================================================
  // ACT 4: BROADSHEET & CLIMAX CTA (720 - 900)
  // =============================================================
  const act4Frame = Math.max(0, frame - 720);

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
      {/* 30-Second Master Audio */}
      <Audio src={staticFile('audio/master_ad_30s.mp3')} volume={1} />

      {/* Global CSS for Paper Texture and High-End Typography */}
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
            box-shadow: 12px 12px 0px #0d0d0b;
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
      {/* ACT 1: THE ENHANCED SENSORY HOOK (Frames 0 - 140 / 0.0s - 4.7s) */}
      {/* =========================================================== */}
      {isAct1 && (
        <AbsoluteFill
          style={{
            backgroundColor: '#0a0a0a',
            color: '#FFFFFF',
            padding: '70px 50px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transform: `translate(${jitterX}px, ${jitterY}px)`,
          }}
        >
          {/* Top Status Bar */}
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
            <span>● PSYCHOLOGICAL TOLL: MODERN MEDIA</span>
            <span>01 / 04</span>
          </div>

          {/* Incoming Push Notification */}
          {pushNotif > 0.05 && (
            <div
              style={{
                backgroundColor: '#222222',
                border: '2px solid #666666',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                transform: `translateY(${interpolate(pushNotif, [0, 1], [-60, 0])}px)`,
                boxShadow: '0 8px 30px rgba(0,0,0,0.8)',
              }}
            >
              <span style={{ fontSize: 32 }}>🚨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: '#ff4d4d', fontWeight: 'bold' }}>
                  PUSH ALERT · BREAKING TRAGEDY
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 3 }}>
                  "Urgent: You won't believe what just collapsed. Tap to read."
                </div>
              </div>
            </div>
          )}

          {/* High-Impact Kinetic Headline */}
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                fontSize: 92,
                lineHeight: 0.95,
                letterSpacing: 1.5,
                color: '#FFFFFF',
                textTransform: 'uppercase',
                opacity: hookPhase1,
                transform: `translateY(${interpolate(hookPhase1, [0, 1], [30, 0])}px)`,
              }}
            >
              WHY ARE YOU ALWAYS{' '}
              <span style={{ color: '#ff3b30', textDecoration: 'underline' }}>
                ANXIOUS
              </span>{' '}
              AFTER READING THE NEWS?
            </div>

            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 26,
                color: '#cccccc',
                marginTop: 20,
                lineHeight: 1.4,
                opacity: hookPhase2,
                transform: `translateY(${interpolate(hookPhase2, [0, 1], [30, 0])}px)`,
              }}
            >
              Because 94% of the modern media does not want to inform you.
              <br />
              <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                They monetize your panic and outrage.
              </span>
            </div>
          </div>

          {/* Horror Popup Stack on Mock Device */}
          <div
            style={{
              position: 'relative',
              height: 940,
              width: '100%',
              margin: '10px 0',
            }}
          >
            {/* Blurry Background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#161616',
                border: '3px solid #333',
                padding: 30,
                opacity: 0.45,
                filter: 'blur(2px)',
              }}
            >
              <div style={{ height: 40, background: '#333', marginBottom: 20 }} />
              <div style={{ height: 260, background: '#444', marginBottom: 20 }} />
              <div style={{ height: 35, background: '#2e2e2e', marginBottom: 15 }} />
              <div style={{ height: 35, background: '#2e2e2e', width: '60%' }} />
            </div>

            {/* Popup 1: Cookie Consent */}
            {p1Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 30,
                  left: 20,
                  right: 20,
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  padding: 28,
                  border: '4px solid #000000',
                  boxShadow: '10px 10px 0px rgba(255,59,48,0.8)',
                  transform: `scale(${p1Spring}) rotate(-2deg)`,
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: '#ff3b30', fontWeight: 'bold' }}>
                  🍪 942 ADVERTISING PARTNERS WANT YOUR DATA
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 10, lineHeight: 1.2 }}>
                  Allow all behavioral tracking or pay $14.99 / month?
                </div>
                <div style={{ marginTop: 18, background: '#000', color: '#fff', padding: 12, textAlign: 'center', fontWeight: 'bold' }}>
                  ACCEPT ALL TRACKERS
                </div>
              </div>
            )}

            {/* Popup 2: Obscene Clickbait */}
            {p2Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 280,
                  left: 10,
                  right: 10,
                  backgroundColor: '#ffff00',
                  color: '#000000',
                  padding: 24,
                  border: '4px solid #ff0000',
                  boxShadow: '12px 12px 0px #000',
                  transform: `scale(${p2Spring}) rotate(2.5deg)`,
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, color: '#cc0000', fontWeight: 900 }}>
                  ⚠️ CLICKBAIT: DOCTORS ARE SPEECHLESS!
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>
                  THIS ONE WEIRD TRICK MELTS BELLY FAT OVERNIGHT!
                </div>
              </div>
            )}

            {/* Popup 3: Autoplay Video Ad */}
            {p3Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 490,
                  left: 25,
                  right: 25,
                  backgroundColor: '#ff2d55',
                  color: '#ffffff',
                  padding: 22,
                  border: '3px solid #ffffff',
                  boxShadow: '12px 12px 0px #000',
                  transform: `scale(${p3Spring}) rotate(-2deg)`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 800 }}>
                    ▶ VIDEO AD (0:30) · SOUND UNMUTED
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 'bold' }}>[X]</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>
                  Claim $5,000 casino bonus right now! Offer expires in 60s!
                </div>
              </div>
            )}

            {/* Popup 4: Paywall Lock */}
            {p4Spring > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 670,
                  left: 15,
                  right: 15,
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  padding: 22,
                  border: '3px solid #ff4d4d',
                  boxShadow: '10px 10px 0px #ff4d4d',
                  transform: `scale(${p4Spring}) rotate(1.2deg)`,
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, color: '#ff4d4d', fontWeight: 'bold' }}>
                  🔒 PAYWALL: 0 OF 0 FREE ARTICLES REMAINING
                </div>
                <div style={{ fontSize: 22, marginTop: 6 }}>
                  $1 for your first 3 days, then renews at $59.99/month.
                </div>
              </div>
            )}

            {/* THE RED STAMP SLAM */}
            {stampSpring > 0.1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '36%',
                  left: '3%',
                  right: '3%',
                  backgroundColor: '#c93b2b',
                  color: '#ffffff',
                  padding: '38px 20px',
                  border: '6px solid #ffffff',
                  boxShadow: '20px 20px 0px #000000',
                  textAlign: 'center',
                  transform: `scale(${stampSpring}) rotate(-6deg)`,
                  zIndex: 50,
                }}
              >
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 76, letterSpacing: 3, lineHeight: 1 }}>
                  THIS IS NOT JOURNALISM.
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 800, letterSpacing: 2, marginTop: 12 }}>
                  THIS IS AN OUTRAGE CASINO.
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
            DISCOVER THE RADICAL ANTIDOTE ▼
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 2: ENTER PLAIN — REAL FRONTPAGE (Frames 140 - 280 / 4.7s - 9.3s) */}
      {/* =========================================================== */}
      {isAct2 && (
        <AbsoluteFill className="paper-bg" style={{ padding: '60px 45px' }}>
          {/* Top Swiss Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: C.border,
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

          {/* REAL MOBILE FOOTAGE IN ACTION (Continuous Smooth 60fps Subpixel Scroll) */}
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
            <div
              className="brut-shadow-lg"
              style={{
                width: 860,
                height: 1220,
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
                  border: C.border,
                  padding: '20px 30px',
                  maxWidth: 780,
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
      {/* ACT 3: THE 5 PRINCIPLES — ULTRA HIGH-IMPACT FULLSCREEN DESIGN */}
      {/* (Frames 280 - 720 / 9.3s - 24.0s) */}
      {/* PERFECT VERTICAL COMPOSITION — ZERO EMPTY BLOCKS */}
      {/* =========================================================== */}
      {isAct3 && (
        <AbsoluteFill
          className="paper-bg"
          style={{
            padding: '60px 50px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Top Swiss Header */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: C.border,
                paddingBottom: 16,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2,
                color: C.ink,
              }}
            >
              <span>PLAIN. OUR 5 CORE PRINCIPLES</span>
              <span style={{ color: C.accent }}>● {p.num} / 05</span>
            </div>

            {/* Section Masthead */}
            <div
              style={{
                marginTop: 20,
                borderBottom: '2px solid #0d0d0b',
                paddingBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 82,
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

              {/* Rule Indicator Badge */}
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 18,
                  fontWeight: 800,
                  background: C.ink,
                  color: C.paper,
                  padding: '6px 16px',
                  letterSpacing: 1.5,
                }}
              >
                RULE {p.num}
              </div>
            </div>
          </div>

          {/* MAIN PRINCIPLE CARD — EXPANDED TALL DESIGN TO FILL SCREEN HARMONIOUSLY */}
          <div
            style={{
              flex: 1,
              margin: '25px 0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              className="brut-shadow-lg"
              style={{
                backgroundColor: C.paper,
                border: C.heavyBorder,
                padding: '45px 45px',
                transform: `scale(${cardEntranceSpring})`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 1120,
              }}
            >
              {/* Card Header Tag Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    backgroundColor: C.accent,
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 17,
                    fontWeight: 800,
                    padding: '8px 18px',
                    letterSpacing: 1.5,
                  }}
                >
                  {p.tag}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 18,
                    fontWeight: 800,
                    color: C.muted,
                    letterSpacing: 1.5,
                  }}
                >
                  {p.subtitle}
                </span>
              </div>

              {/* Massive Principle Title & Body */}
              <div style={{ margin: '15px 0' }}>
                <div
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: 78,
                    fontWeight: 900,
                    letterSpacing: -2,
                    lineHeight: 1.0,
                    color: C.ink,
                  }}
                >
                  <span style={{ color: C.accent, marginRight: 15 }}>{p.num}.</span>
                  {p.title}
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 27,
                    lineHeight: 1.45,
                    color: '#2a2822',
                    marginTop: 18,
                  }}
                >
                  {p.dek}
                </div>
              </div>

              {/* Visual Component Specific to the Principle */}
              <div
                style={{
                  borderTop: '2px solid #34312a',
                  paddingTop: 24,
                  opacity: visualEntranceSpring,
                  transform: `translateY(${interpolate(visualEntranceSpring, [0, 1], [20, 0])}px)`,
                }}
              >
                {p.renderVisual()}
              </div>

              {/* Progress Bar & Footer */}
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 15,
                    color: C.muted,
                    marginBottom: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  <span>PROGRESSION</span>
                  <span>{currentPIndex + 1} OF 5 PILLARS</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                  }}
                >
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: 12,
                        backgroundColor:
                          idx === currentPIndex
                            ? C.accent
                            : idx < currentPIndex
                            ? C.ink
                            : 'rgba(13, 13, 11, 0.2)',
                        border: '1px solid #0d0d0b',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Swiss Sub-Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '2px solid #0d0d0b',
              paddingTop: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 16,
              color: C.muted,
              letterSpacing: 1.5,
            }}
          >
            <span>PLAIN-NEWS.CH</span>
            <span>FOUNDED BY SIMON EGGERT · OPEN SOURCE</span>
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 4: BROADSHEET & CLIMAX CTA (Frames 720 - 900 / 24.0s - 30.0s) */}
      {/* =========================================================== */}
      {isAct4 && (
        <AbsoluteFill className="paper-bg" style={{ padding: '60px 45px' }}>
          {/* Top Swiss Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: C.border,
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
                border: C.border,
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
