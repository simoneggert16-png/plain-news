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

// =====================================================================
// LUXURY 3D IPHONE 16 PRO DEVICE COMPONENT
// =====================================================================
const Phone3D = ({
  children,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
  scale = 1,
  translateY = 0,
  translateX = 0,
  shadowIntensity = 1,
  screenContent,
  screenScrollY = 0,
  width = 540,
  height = 1100,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        margin: '0 auto',
        perspective: 1500,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* 3D Titanium Chassis */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 64,
          background: 'linear-gradient(135deg, #32302d 0%, #171615 45%, #2e2c29 100%)',
          padding: 12,
          boxShadow: `
            ${-35 * shadowIntensity}px ${50 * shadowIntensity}px ${125 * shadowIntensity}px -20px rgba(0,0,0,0.65),
            0 25px 50px -10px rgba(0,0,0,0.4),
            inset 0 1px 2px rgba(255,255,255,0.25),
            inset 0 -1px 2px rgba(0,0,0,0.85)
          `,
          transform: `
            translate3d(${translateX}px, ${translateY}px, 0px)
            rotateX(${rotX}deg)
            rotateY(${rotY}deg)
            rotateZ(${rotZ}deg)
            scale(${scale})
          `,
          transformOrigin: 'center center',
        }}
      >
        {/* Specular Titanium Edge */}
        <div
          style={{
            position: 'absolute',
            inset: 1,
            borderRadius: 62,
            border: '1.5px solid rgba(255,255,255,0.15)',
            pointerEvents: 'none',
          }}
        />

        {/* Screen Display Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundColor: '#0a0a09',
            borderRadius: 54,
            overflow: 'hidden',
            border: '3px solid #000000',
          }}
        >
          {screenContent ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transform: `translateY(${screenScrollY}px)`,
              }}
            >
              {screenContent}
            </div>
          ) : (
            children
          )}

          {/* Dynamic Island Pill */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 140,
              height: 38,
              backgroundColor: '#000000',
              borderRadius: 24,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {/* Camera */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#07111e',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#0f2742' }} />
            </div>

            {/* Sensor */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#111',
              }}
            />
          </div>

          {/* Glass Glare */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(130deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 30%, transparent 60%)',
              pointerEvents: 'none',
              zIndex: 90,
            }}
          />

          {/* Home Bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 150,
              height: 5,
              backgroundColor: 'rgba(255,255,255,0.7)',
              borderRadius: 3,
              zIndex: 95,
            }}
          />
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// MAIN MOTION AD COMPOSITION
// =====================================================================
export const PlainMotionAd = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // -------------------------------------------------------------
  // LUXURY SWISS MODERNIST COLOR SYSTEM
  // -------------------------------------------------------------
  const C = {
    paper: '#f4efe6',
    paperLight: '#faf6ee',
    paperDark: '#ece5d8',
    ink: '#0b0c0e',
    inkMuted: '#3f3e3a',
    inkSubtle: '#716e65',
    red: '#dc2626',
    redGlow: 'rgba(220, 38, 38, 0.35)',
    border: '1.5px solid rgba(11, 12, 14, 0.14)',
    borderBold: '2px solid #0b0c0e',
    cardShadow: '0 20px 50px -15px rgba(20, 18, 14, 0.12), 0 10px 20px -8px rgba(20, 18, 14, 0.08)',
  };

  // -------------------------------------------------------------
  // TIMELINE SEGMENTS (900 frames = 30.0s @ 30fps)
  // Perfectly mapped to the neural voiceover audio:
  // 0.0s - 4.7s   (0 - 140): Hook
  // 4.7s - 9.3s   (140 - 280): Antidote Product Reveal
  // 9.3s - 23.5s  (280 - 705): Five Principles (85 frames each)
  // 23.5s - 30.0s (705 - 900): Broadsheet Climax & CTA
  // -------------------------------------------------------------
  const isAct1 = frame < 140;
  const isAct2 = frame >= 140 && frame < 280;
  const isAct3 = frame >= 280 && frame < 705;
  const isAct4 = frame >= 705;

  // Flash cut transition at 4.6s (frame 137 - 146)
  const cutFlash = interpolate(frame, [137, 140, 146], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // =============================================================
  // ACT 1: KINETIC HOOK (0 - 140)
  // =============================================================
  const title1Spring = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 180 } });
  const anxiousSpring = spring({ frame: frame - 18, fps, config: { damping: 12, stiffness: 220 } });
  const subSpring = spring({ frame: frame - 55, fps, config: { damping: 15, stiffness: 160 } });

  const a1PhoneRotX = interpolate(frame, [0, 138], [12, 4]);
  const a1PhoneRotY = interpolate(frame, [0, 138], [-16, -5]);
  const a1PhoneScale = interpolate(frame, [0, 138], [0.92, 1.04]);

  const jitterIntensity = frame > 65 ? interpolate(frame, [65, 138], [0, 9]) : 0;
  const jitterX = Math.sin(frame * 4.2) * jitterIntensity;
  const jitterY = Math.cos(frame * 5.1) * jitterIntensity;

  const notif1 = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 200 } });
  const notif2 = spring({ frame: frame - 68, fps, config: { damping: 12, stiffness: 200 } });
  const paywallModal = spring({ frame: frame - 92, fps, config: { damping: 11, stiffness: 190 } });
  const truthStamp = spring({ frame: frame - 116, fps, config: { damping: 10, stiffness: 240 } });

  // =============================================================
  // ACT 2: ENTER PLAIN — THE ANTIDOTE (140 - 280)
  // =============================================================
  const act2Frame = Math.max(0, frame - 140);
  const a2IntroSpring = spring({ frame: act2Frame, fps, config: { damping: 16, stiffness: 130 } });
  const a2PhoneEntrance = spring({ frame: act2Frame - 8, fps, config: { damping: 15, stiffness: 120 } });

  const a2ScrollY = interpolate(act2Frame, [20, 135], [0, -820], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 0.05, 0.2, 1),
  });

  const a2Badge1 = spring({ frame: act2Frame - 38, fps, config: { damping: 14, stiffness: 180 } });
  const a2Badge2 = spring({ frame: act2Frame - 54, fps, config: { damping: 14, stiffness: 180 } });

  // =============================================================
  // ACT 3: THE 5 PRINCIPLES — GOLDEN PROPORTIONS (280 - 705)
  // =============================================================
  const act3Frame = Math.max(0, frame - 280);
  const currentPIndex = Math.min(4, Math.max(0, Math.floor(act3Frame / 85)));
  const pLocalFrame = act3Frame % 85;

  const cardEntrance = spring({
    frame: pLocalFrame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const visualEntrance = spring({
    frame: pLocalFrame - 10,
    fps,
    config: { damping: 14, stiffness: 160 },
  });

  // Data for the 5 principles - designed to perfectly fill the 1080x1920 canvas
  const principles = [
    {
      index: '01',
      category: 'RADICAL OBJECTIVITY',
      title: 'ZERO SPIN',
      subtitle: 'Pure verified events. Zero emotional manipulation.',
      dek: 'No speculation, no loaded adjectives, no sensationalist outrage. Every story is reduced to verified facts, hard metrics, and authenticated direct quotes.',
      renderVisual: (pFrame = 0) => {
        // Bespoke Transition for P1: Outrage Strikethrough & Fact Seal Slam
        const p1Strikethrough = interpolate(pFrame, [12, 32], [0, 100], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const p1FactReveal = spring({
          frame: pFrame - 22,
          fps: 30,
          config: { damping: 14, stiffness: 180 },
        });
        const p1ExitX = interpolate(pFrame, [72, 85], [0, -1200], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        });
        const p1ExitOpacity = interpolate(pFrame, [72, 84], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              width: '100%',
              transform: `translateX(${p1ExitX}px)`,
              opacity: p1ExitOpacity,
            }}
          >
            {/* Card 1: Sensationalist Media */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 24,
                border: '2px solid rgba(220, 38, 38, 0.4)',
                padding: '38px 40px',
                minHeight: 280,
                boxShadow: '0 16px 40px -10px rgba(220, 38, 38, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: C.red,
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 800,
                      letterSpacing: 1.5,
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: C.red }} />
                    CONVENTIONAL MEDIA (SENSATIONALISM)
                  </div>
                  <span
                    style={{
                      backgroundColor: 'rgba(220, 38, 38, 0.12)',
                      color: C.red,
                      padding: '5px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 800,
                    }}
                  >
                    MANIPULATION DETECTED
                  </span>
                </div>
                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 34,
                      lineHeight: 1.35,
                      color: '#716e65',
                      fontWeight: 600,
                    }}
                  >
                    "Disastrous bill sparks furious civil backlash as democracy collapses in total chaos!"
                  </div>
                  {/* Kinetic Red Laser Strikethrough */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      height: 6,
                      backgroundColor: C.red,
                      width: `${p1Strikethrough}%`,
                      boxShadow: '0 0 16px rgba(220, 38, 38, 0.6)',
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  gap: 20,
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: C.red,
                  fontWeight: 700,
                }}
              >
                <span>✕ 3 LOADED ADJECTIVES REMOVED</span>
                <span>✕ APOCALYPTIC FRAMING PURGED</span>
              </div>
            </div>

            {/* Kinetic Transformation Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                padding: '4px 0',
              }}
            >
              <div style={{ height: 1.5, flex: 1, backgroundColor: 'rgba(11, 12, 14, 0.18)' }} />
              <div
                style={{
                  backgroundColor: C.ink,
                  color: '#ffffff',
                  padding: '10px 24px',
                  borderRadius: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                }}
              >
                PLAIN RADICAL OBJECTIVITY FILTER ▼
              </div>
              <div style={{ height: 1.5, flex: 1, backgroundColor: 'rgba(11, 12, 14, 0.18)' }} />
            </div>

            {/* Card 2: PLAIN Fact-Only Card (Revealed with kinetic impact) */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 24,
                border: '3.5px solid #0b0c0e',
                padding: '40px 40px',
                minHeight: 310,
                boxShadow: '0 24px 60px -12px rgba(0,0,0,0.18)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: p1FactReveal,
                transform: `scale(${interpolate(p1FactReveal, [0, 1], [0.94, 1])}) translateY(${interpolate(p1FactReveal, [0, 1], [30, 0])}px)`,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: C.ink,
                      fontSize: 15,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 800,
                      letterSpacing: 1.5,
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: C.ink }} />
                    PLAIN (RADICAL OBJECTIVITY)
                  </div>
                  <span
                    style={{
                      backgroundColor: C.ink,
                      color: '#ffffff',
                      padding: '6px 14px',
                      borderRadius: 14,
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 800,
                    }}
                  >
                    100% FACTUAL RECORD
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: 38,
                    lineHeight: 1.3,
                    color: C.ink,
                    fontWeight: 700,
                  }}
                >
                  "Senate approves infrastructure legislation 51 to 49 following 8-hour committee session."
                </div>
              </div>
              <div
                style={{
                  marginTop: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 20px',
                  backgroundColor: 'rgba(11, 12, 14, 0.05)',
                  border: '1.5px solid rgba(11, 12, 14, 0.12)',
                  borderRadius: 20,
                  color: C.ink,
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  alignSelf: 'flex-start',
                }}
              >
                ✓ PRIMARY DATA ONLY · ZERO EMOTIONAL DISTORTION
              </div>
            </div>

            {/* Audit Telemetry Metric Bar */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 18,
                border: C.border,
                padding: '20px 28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14,
                fontWeight: 700,
                color: C.inkMuted,
              }}
            >
              <span>OUTRAGE INDEX: 0.00%</span>
              <span style={{ color: C.red }}>● AUDIT: 100% VERIFIED</span>
              <span>READ TIME: 24 SECONDS</span>
            </div>
          </div>
        );
      },
    },
    {
      index: '02',
      category: 'INDEPENDENT CONFIRMATION',
      title: 'TWO-SOURCE RULE',
      subtitle: 'Zero rumors. Zero uncorroborated leaks.',
      dek: 'A story does not enter our newsroom until at least two independent, established global primary news organizations have matched and confirmed the factual core.',
      renderVisual: (pFrame = 0) => {
        // Bespoke Transition for P2: Dual-Wire Horizontal Split Collision
        const wire1Slide = interpolate(pFrame, [0, 24], [-600, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const wire2Slide = interpolate(pFrame, [0, 24], [600, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const sealImpact = spring({
          frame: pFrame - 20,
          fps: 30,
          config: { damping: 12, stiffness: 220 },
        });
        const p2ExitY = interpolate(pFrame, [72, 85], [0, -1000], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        });
        const p2ExitOpacity = interpolate(pFrame, [72, 84], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              width: '100%',
              transform: `translateY(${p2ExitY}px)`,
              opacity: p2ExitOpacity,
            }}
          >
            {/* Dual Wires Collision Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Wire 1: Reuters (Slides from Left) */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 24,
                  border: C.border,
                  padding: '44px 34px',
                  height: 480,
                  boxShadow: C.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transform: `translateX(${wire1Slide}px)`,
                }}
              >
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.inkSubtle }}>
                    PRIMARY WIRE · 08:14 UTC
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 52, fontWeight: 700, margin: '14px 0 16px', color: C.ink }}>
                    Reuters
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      color: C.ink,
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: "'JetBrains Mono', monospace",
                      marginBottom: 16,
                      backgroundColor: 'rgba(11, 12, 14, 0.06)',
                      padding: '5px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.red }} />
                    VERIFIED FACT RECORD
                  </div>
                </div>
                <div style={{ fontSize: 18, color: C.inkMuted, lineHeight: 1.5 }}>
                  Primary legislative roll call and official transcript confirmed by parliamentary desk in Washington.
                </div>
              </div>

              {/* Wire 2: AP News (Slides from Right) */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 24,
                  border: C.border,
                  padding: '44px 34px',
                  height: 480,
                  boxShadow: C.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transform: `translateX(${wire2Slide}px)`,
                }}
              >
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.inkSubtle }}>
                    SECONDARY WIRE · 08:16 UTC
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 52, fontWeight: 700, margin: '14px 0 16px', color: C.ink }}>
                    AP News
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      color: C.ink,
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: "'JetBrains Mono', monospace",
                      marginBottom: 16,
                      backgroundColor: 'rgba(11, 12, 14, 0.06)',
                      padding: '5px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.red }} />
                    CROSS-CORROBORATED
                  </div>
                </div>
                <div style={{ fontSize: 18, color: C.inkMuted, lineHeight: 1.5 }}>
                  Independent newsroom correspondent validated voting margin and quorum protocol on-site.
                </div>
              </div>
            </div>

            {/* Central Consensus Seal (Impact Slam) */}
            <div
              style={{
                backgroundColor: C.ink,
                borderRadius: 22,
                padding: '34px 38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                transform: `scale(${interpolate(sealImpact, [0, 1], [0.85, 1])})`,
                opacity: sealImpact,
              }}
            >
              <div>
                <div style={{ color: '#ffffff', fontSize: 26, fontWeight: 800 }}>
                  Automatic Dual-Wire Corroboration Seal
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>
                  Zero unverified single-source claims enter the feed.
                </div>
              </div>
              <div
                style={{
                  backgroundColor: C.red,
                  color: '#ffffff',
                  padding: '12px 26px',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 900,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 1.5,
                }}
              >
                CORROBORATED
              </div>
            </div>

            {/* Bottom Security Manifesto */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 18,
                border: C.border,
                padding: '24px 32px',
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 22,
                color: C.inkMuted,
                textAlign: 'center',
              }}
            >
              "If only one outlet is reporting it, it is not news. It is an unverified rumor."
            </div>
          </div>
        );
      },
    },
    {
      index: '03',
      category: 'MEDIA LITERACY',
      title: 'EXPOSE THE FRAMING',
      subtitle: 'Side-by-side partisan comparison.',
      dek: 'We extract and contrast opposing headlines simultaneously. Partisan manipulation and narrative agendas become instantly visible to the reader.',
      renderVisual: (pFrame = 0) => {
        // Bespoke Transition for P3: Comparative Aperture Expand & Center Synthesis Punch
        const p3Entrance = spring({
          frame: pFrame,
          fps: 30,
          config: { damping: 14, stiffness: 180 },
        });
        const p3CenterPunch = spring({
          frame: pFrame - 18,
          fps: 30,
          config: { damping: 12, stiffness: 220 },
        });
        const p3ExitScale = interpolate(pFrame, [70, 85], [1, 0.82], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const p3ExitOpacity = interpolate(pFrame, [70, 85], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              width: '100%',
              transform: `scale(${p3ExitScale})`,
              opacity: p3ExitOpacity,
            }}
          >
            {/* Outlet Left: Partisan framing (Strict Swiss Monochromatic Ink) */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 22,
                border: C.border,
                padding: '28px 34px',
                borderLeft: '10px solid #0b0c0e',
                boxShadow: C.cardShadow,
                opacity: p3Entrance,
                transform: `translateX(${interpolate(p3Entrance, [0, 1], [-80, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.ink, fontWeight: 800 }}>
                  LEFT-LEANING NARRATIVE LENS:
                </div>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.ink, backgroundColor: 'rgba(11, 12, 14, 0.08)', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                  EMOTIONAL BIAS: 84%
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
                "Historic progressive triumph transforms national economy and uplifts working families."
              </div>
              <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.inkSubtle, marginTop: 8 }}>
                EDITORIAL FRAMING: TRIUMPHANT · SOCIAL REFORM EMPHASIS
              </div>
            </div>

            {/* Outlet Right: Partisan framing (Strict Swiss Red Accent) */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 22,
                border: C.border,
                padding: '28px 34px',
                borderLeft: `10px solid ${C.red}`,
                boxShadow: C.cardShadow,
                opacity: p3Entrance,
                transform: `translateX(${interpolate(p3Entrance, [0, 1], [80, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.red, fontWeight: 800 }}>
                  RIGHT-LEANING NARRATIVE LENS:
                </div>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.red, backgroundColor: 'rgba(220, 38, 38, 0.08)', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                  EMOTIONAL BIAS: 91%
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
                "Reckless federal spending package fuels national debt and ignites inflation crisis."
              </div>
              <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.inkSubtle, marginTop: 8 }}>
                EDITORIAL FRAMING: CATASTROPHIC · FISCAL DEFICIT EMPHASIS
              </div>
            </div>

            {/* Center PLAIN Synthesis (Punches into center) */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 24,
                border: '3.5px solid #0b0c0e',
                padding: '30px 36px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
                opacity: p3CenterPunch,
                transform: `scale(${interpolate(p3CenterPunch, [0, 1], [0.92, 1])})`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                <div
                  style={{
                    backgroundColor: C.ink,
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 900,
                    letterSpacing: 1,
                  }}
                >
                  PLAIN SYNTHESIS
                </div>
                <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.ink, fontWeight: 800 }}>
                  ● 100% FACTUAL RECONSTRUCTION
                </div>
              </div>
              <div style={{ fontSize: 27, fontWeight: 800, color: C.ink, lineHeight: 1.3 }}>
                "Senate approves $1.2T infrastructure bill 51 to 49 following 8-hour committee session."
              </div>
              <div style={{ fontSize: 14, color: C.inkMuted, marginTop: 8, lineHeight: 1.45 }}>
                Zero rhetorical manipulation. The verifiable core separated from ideological theater.
              </div>
            </div>

            {/* Bottom Analytical Principle Note */}
            <div
              style={{
                backgroundColor: C.ink,
                borderRadius: 18,
                padding: '22px 30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 15px 40px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ color: '#ffffff', fontSize: 17, fontWeight: 700, fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic' }}>
                "When you see the spin explicitly labeled, manipulation loses all power over you."
              </div>
              <div
                style={{
                  color: C.red,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  whiteSpace: 'nowrap',
                  marginLeft: 18,
                }}
              >
                RADICAL TRANSPARENCY
              </div>
            </div>
          </div>
        );
      },
    },
    {
      index: '04',
      category: 'TOTAL INDEPENDENCE',
      title: 'ZERO COMMERCE',
      subtitle: 'Zero ads. Zero paywalls. Zero tracking.',
      dek: 'Information is a public utility, not an attention slot machine. We are 100% free, unconditionally open, and built with zero financial incentives to manipulate.',
      renderVisual: (pFrame = 0) => {
        // Bespoke Transition for P4: 4-Beat Percussive Cascade of ZEROS
        const tileItems = [
          { val: '0', label: 'ADVERTISEMENTS', desc: 'No sponsored articles, no banner injections, zero commercial bias.' },
          { val: '0', label: 'PAYWALLS', desc: 'Completely open for all 8 billion humans on Earth.' },
          { val: '0', label: 'TRACKING COOKIES', desc: 'Zero analytics pixels, zero behavioral surveillance.' },
          { val: '0', label: 'SUBSCRIPTIONS', desc: 'No credit cards required. Unconditionally free forever.' },
        ];

        const p4ExitX = interpolate(pFrame, [72, 85], [0, 1200], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        });
        const p4ExitOpacity = interpolate(pFrame, [72, 84], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              width: '100%',
              transform: `translateX(${p4ExitX}px)`,
              opacity: p4ExitOpacity,
            }}
          >
            {/* 4 Architectural Luxury Tiles - 4-Beat Percussive Entry */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {tileItems.map((item, idx) => {
                const beatSpring = spring({
                  frame: pFrame - idx * 6,
                  fps: 30,
                  config: { damping: 12, stiffness: 220 },
                });
                return (
                  <div
                    key={item.label}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 24,
                      border: C.border,
                      padding: '38px 32px',
                      height: 330,
                      boxShadow: C.cardShadow,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: beatSpring,
                      transform: `scale(${interpolate(beatSpring, [0, 1], [0.85, 1])}) translateY(${interpolate(beatSpring, [0, 1], [40, 0])}px)`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 96, fontWeight: 900, color: C.red, fontFamily: "'Inter', sans-serif", lineHeight: 0.9 }}>
                        {item.val}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, fontFamily: "'JetBrains Mono', monospace", marginTop: 14 }}>
                        {item.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, color: C.inkSubtle, lineHeight: 1.45 }}>
                      {item.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Simon Eggert Quote Card */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 22,
                padding: '32px 42px',
                borderLeft: '8px solid #0b0c0e',
                border: C.border,
                boxShadow: C.cardShadow,
                opacity: spring({ frame: pFrame - 28, fps: 30, config: { damping: 14, stiffness: 180 } }),
              }}
            >
              <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 28, color: C.ink, lineHeight: 1.35 }}>
                "Information is a public utility, not an attention casino."
              </div>
              <div style={{ fontSize: 15, fontFamily: "'JetBrains Mono', monospace", color: C.inkSubtle, marginTop: 12, fontWeight: 700 }}>
                — Simon Eggert, Founder of PLAIN
              </div>
            </div>
          </div>
        );
      },
    },
    {
      index: '05',
      category: 'AI VERIFICATION',
      title: 'ADVERSARIAL AI AUDIT',
      subtitle: 'Dual-engine cross-examination pipeline.',
      dek: 'A primary AI Reporter synthesizes the verified wires. A separate, ruthless Adversarial AI Auditor challenges every single claim before publication.',
      renderVisual: (pFrame = 0) => {
        // Bespoke Transition for P5: Dual-Agent Convergence & Cross-Examination Scan
        const reporterDrop = spring({
          frame: pFrame,
          fps: 30,
          config: { damping: 14, stiffness: 190 },
        });
        const auditorRise = spring({
          frame: pFrame - 8,
          fps: 30,
          config: { damping: 14, stiffness: 190 },
        });
        const scanLineX = interpolate(pFrame, [20, 50], [0, 100], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const consensusBadge = spring({
          frame: pFrame - 36,
          fps: 30,
          config: { damping: 12, stiffness: 220 },
        });
        const p5ExitScale = interpolate(pFrame, [72, 85], [1, 0.9], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const p5ExitOpacity = interpolate(pFrame, [72, 84], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              width: '100%',
              transform: `scale(${p5ExitScale})`,
              opacity: p5ExitOpacity,
            }}
          >
            {/* Engine 1: Autonomous AI Reporter (Enters from Top) */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 22,
                border: C.border,
                padding: '30px 36px',
                boxShadow: C.cardShadow,
                opacity: reporterDrop,
                transform: `translateY(${interpolate(reporterDrop, [0, 1], [-40, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.inkSubtle, fontWeight: 700 }}>
                    STAGE 01 · WIRE INGESTION & FACT SYNTHESIS
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: C.ink, marginTop: 4 }}>
                    Autonomous AI Reporter
                  </div>
                  <div style={{ fontSize: 16, color: C.inkMuted, marginTop: 4 }}>
                    Ingests live primary global wires & extracts immutable factual records.
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: C.ink,
                    color: '#ffffff',
                    padding: '10px 22px',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 900,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 1.5,
                  }}
                >
                  REPORTER
                </div>
              </div>

              {/* Telemetry Record */}
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  backgroundColor: 'rgba(11, 12, 14, 0.04)',
                  borderRadius: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: C.inkSubtle }}>WIRES: Reuters (08:14 UTC) + AP (08:16 UTC)</span>
                <span style={{ color: C.ink, fontWeight: 700 }}>✓ 18 immutable data points extracted</span>
              </div>
            </div>

            {/* Kinetic Cross-Examination Scan Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                position: 'relative',
              }}
            >
              <div style={{ height: 2, flex: 1, backgroundColor: 'rgba(220, 38, 38, 0.25)', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: -2,
                    left: 0,
                    height: 6,
                    width: `${scanLineX}%`,
                    backgroundColor: C.red,
                    boxShadow: '0 0 14px rgba(220, 38, 38, 0.8)',
                    borderRadius: 3,
                  }}
                />
              </div>
              <div
                style={{
                  backgroundColor: C.red,
                  color: '#ffffff',
                  padding: '9px 22px',
                  borderRadius: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                }}
              >
                ADVERSARIAL CROSS-EXAMINATION PROTOCOL ▼
              </div>
              <div style={{ height: 2, flex: 1, backgroundColor: 'rgba(220, 38, 38, 0.25)' }} />
            </div>

            {/* Engine 2: Adversarial AI Auditor (Enters from Bottom) */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 22,
                border: '3px solid #dc2626',
                padding: '30px 36px',
                boxShadow: '0 20px 50px -10px rgba(220, 38, 38, 0.16)',
                opacity: auditorRise,
                transform: `translateY(${interpolate(auditorRise, [0, 1], [40, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.red, fontWeight: 800 }}>
                    STAGE 02 · RUTHLESS ADVERSARIAL CROSS-EXAMINATION
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: C.ink, marginTop: 4 }}>
                    Adversarial AI Auditor
                  </div>
                  <div style={{ fontSize: 16, color: C.inkMuted, marginTop: 4 }}>
                    Challenges every phrase. Ruthlessly purges bias, speculation, and spin.
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: C.red,
                    color: '#ffffff',
                    padding: '10px 22px',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 900,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 1.5,
                  }}
                >
                  AUDITOR
                </div>
              </div>

              {/* Telemetry Record */}
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  backgroundColor: 'rgba(220, 38, 38, 0.05)',
                  borderRadius: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: C.red, fontWeight: 700 }}>AUDIT: 2 speculative adjectives challenged</span>
                <span style={{ color: C.ink, fontWeight: 700 }}>✓ Replaced with factual metrics</span>
              </div>
            </div>

            {/* Consensus Verification Bar */}
            <div
              style={{
                backgroundColor: C.ink,
                borderRadius: 16,
                padding: '18px 26px',
                textAlign: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15,
                fontWeight: 800,
                color: '#ffffff',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                opacity: consensusBadge,
                transform: `scale(${interpolate(consensusBadge, [0, 1], [0.94, 1])})`,
              }}
            >
              <span style={{ color: C.red, marginRight: 10 }}>●</span>
              ADVERSARIAL CONSENSUS VERIFIED BEFORE ANY STORY GOES LIVE
            </div>

            {/* Editorial Rule Quote */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 18,
                border: C.border,
                padding: '20px 28px',
                fontFamily: "'Newsreader', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 21,
                color: C.inkMuted,
                textAlign: 'center',
                boxShadow: C.cardShadow,
              }}
            >
              "One AI writes the facts. A second adversarial AI fights to tear them down."
            </div>
          </div>
        );
      },
    },
  ];

  const currentPrinciple = principles[currentPIndex];

  // =============================================================
  // ACT 4: THE MONUMENTAL CTA (705 - 900)
  // =============================================================
  const act4Frame = Math.max(0, frame - 705);
  const a4Entrance = spring({ frame: act4Frame, fps, config: { damping: 16, stiffness: 120 } });
  const a4CardSpring = spring({ frame: act4Frame - 25, fps, config: { damping: 14, stiffness: 140 } });
  const a4DeviceSpring = spring({ frame: act4Frame - 15, fps, config: { damping: 15, stiffness: 130 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.paper,
        color: C.ink,
        fontFamily: "'Inter', -apple-system, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* 30-Second Master Neural Voiceover & Soundscape */}
      <Audio src={staticFile('audio/master_ad_30s_v3.mp3')} volume={1} />

      {/* Global Luxury Typography & Editorial Styling */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,600&family=JetBrains+Mono:wght@500;600;700;800&display=swap');
          
          * {
            box-sizing: border-box;
          }

          .paper-texture {
            background-color: #f4efe6;
            background-image: radial-gradient(rgba(11, 12, 14, 0.035) 1px, transparent 1px);
            background-size: 24px 24px;
          }

          .dark-studio {
            background-color: #09090b;
            background-image: 
              radial-gradient(ellipse at 50% 30%, #1a1a20 0%, #09090b 80%);
          }
        `}
      </style>

      {/* =========================================================== */}
      {/* ACT 1: KINETIC HOOK (0 - 140) */}
      {/* =========================================================== */}
      {isAct1 && (
        <AbsoluteFill
          className="dark-studio"
          style={{
            padding: '70px 55px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transform: `translate(${jitterX}px, ${jitterY}px)`,
          }}
        >
          {/* Subtle Top Metadata */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
              paddingBottom: 20,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 16,
              letterSpacing: 2,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.red }} />
              INVESTIGATION: THE ATTENTION ECONOMY
            </span>
            <span>01 / 04</span>
          </div>

          {/* Kinetic Typography Question */}
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 68,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                color: '#ffffff',
                textTransform: 'uppercase',
                opacity: title1Spring,
                transform: `translateY(${interpolate(title1Spring, [0, 1], [30, 0])}px)`,
              }}
            >
              Why are you always{' '}
              <span
                style={{
                  color: '#ef4444',
                  textShadow: '0 0 40px rgba(239, 68, 68, 0.6)',
                  opacity: anxiousSpring,
                  display: 'inline-block',
                  transform: `scale(${interpolate(anxiousSpring, [0, 1], [0.92, 1])})`,
                }}
              >
                anxious
              </span>{' '}
              after reading the news?
            </div>

            <div
              style={{
                marginTop: 24,
                fontFamily: "'Newsreader', Georgia, serif",
                fontSize: 30,
                fontStyle: 'italic',
                color: 'rgba(255, 255, 255, 0.75)',
                lineHeight: 1.35,
                opacity: subSpring,
                transform: `translateY(${interpolate(subSpring, [0, 1], [20, 0])}px)`,
              }}
            >
              Because modern media does not want to inform you.
              <br />
              <strong style={{ color: '#ffffff', fontStyle: 'normal', fontWeight: 600 }}>
                They monetize your panic and rage.
              </strong>
            </div>
          </div>

          {/* 3D Phone in Dark Studio Space with Chaotic Media Overload */}
          <div
            style={{
              position: 'relative',
              height: 980,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Phone3D
              rotX={a1PhoneRotX}
              rotY={a1PhoneRotY}
              scale={a1PhoneScale}
              shadowIntensity={1.2}
              screenContent={
                <div style={{ padding: 24, paddingTop: 60, color: '#fff' }}>
                  <div
                    style={{
                      height: 18,
                      width: '40%',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderRadius: 4,
                      marginBottom: 20,
                    }}
                  />
                  <div
                    style={{
                      height: 140,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      marginBottom: 16,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                  <div
                    style={{
                      height: 80,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      borderRadius: 12,
                      marginBottom: 16,
                    }}
                  />
                </div>
              }
            />

            {/* Notification Alert 1 */}
            {notif1 > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 100,
                  left: 30,
                  right: 30,
                  backgroundColor: 'rgba(20, 20, 24, 0.94)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 20,
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '22px 26px',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 30px rgba(239, 68, 68, 0.2)',
                  transform: `scale(${notif1}) translateY(${interpolate(notif1, [0, 1], [-40, 0])}px) rotate(-1.5deg)`,
                  zIndex: 40,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#ef4444', fontWeight: 700 }}>
                    BREAKING ALERT · HIGH SENSATIONALISM
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 8, lineHeight: 1.25 }}>
                  "Urgent: Disaster Looms as Tensions Reach Catastrophic Breaking Point!"
                </div>
              </div>
            )}

            {/* Notification Alert 2 */}
            {notif2 > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 320,
                  left: 20,
                  right: 20,
                  backgroundColor: 'rgba(24, 24, 28, 0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 20,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '22px 26px',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
                  transform: `scale(${notif2}) rotate(2deg)`,
                  zIndex: 45,
                }}
              >
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                  PRIVACY BREACH WARNING
                </div>
                <div style={{ fontSize: 21, fontWeight: 700, color: '#fff', marginTop: 6, lineHeight: 1.3 }}>
                  842 behavioral advertisers are currently tracking your location and read history.
                </div>
              </div>
            )}

            {/* Paywall Gate Modal */}
            {paywallModal > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: 540,
                  left: 35,
                  right: 35,
                  backgroundColor: '#ffffff',
                  borderRadius: 22,
                  padding: '28px 28px',
                  boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
                  transform: `scale(${paywallModal}) rotate(-1deg)`,
                  zIndex: 50,
                  color: '#000',
                }}
              >
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#ef4444', fontWeight: 800 }}>
                  PAYWALL RESTRICTION
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8, lineHeight: 1.2 }}>
                  You have read 0 of 0 free articles. Pay $29.99/mo to continue.
                </div>
                <div
                  style={{
                    marginTop: 18,
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    borderRadius: 12,
                    padding: '14px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  SUBSCRIBE OR LEAVE
                </div>
              </div>
            )}

            {/* The Slapped Truth Stamp */}
            {truthStamp > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  top: '40%',
                  left: '4%',
                  right: '4%',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  borderRadius: 20,
                  padding: '36px 30px',
                  boxShadow: '0 30px 90px rgba(220, 38, 38, 0.6), 0 0 0 4px #ffffff',
                  transform: `scale(${truthStamp}) rotate(-4deg)`,
                  zIndex: 60,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 44, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  This is not journalism.
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 800,
                    letterSpacing: 2,
                    marginTop: 12,
                    color: '#fecaca',
                  }}
                >
                  THIS IS AN OUTRAGE CASINO.
                </div>
              </div>
            )}
          </div>

          {/* Bottom Prompt */}
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 16,
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              letterSpacing: 2,
            }}
          >
            PREPARE FOR THE RADICAL ANTIDOTE
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 2: ENTER PLAIN — THE ANTIDOTE (140 - 280) */}
      {/* =========================================================== */}
      {isAct2 && (
        <AbsoluteFill className="paper-texture" style={{ padding: '60px 50px' }}>
          {/* Top Swiss Editorial Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: C.borderBold,
              paddingBottom: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 16,
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            <span>PLAIN · SWISS MODERNIST NEWSROOM</span>
            <span style={{ color: C.red }}>● 02 / 04</span>
          </div>

          {/* Hero Masthead Reveal */}
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              borderBottom: C.border,
              paddingBottom: 20,
              opacity: a2IntroSpring,
              transform: `translateY(${interpolate(a2IntroSpring, [0, 1], [25, 0])}px)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 104,
                  fontWeight: 900,
                  letterSpacing: '-0.05em',
                  lineHeight: 0.9,
                  color: C.ink,
                }}
              >
                PLAIN.
              </span>
              <span
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 42,
                  fontStyle: 'italic',
                  color: C.inkMuted,
                }}
              >
                The antidote.
              </span>
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                color: C.red,
                letterSpacing: 1.5,
              }}
            >
              ● LIVE GLOBAL EDITION
            </div>
          </div>

          {/* Majestic 3D Device Showcase with Real English Frontpage */}
          <div
            style={{
              position: 'relative',
              height: 1080,
              width: '100%',
              margin: '25px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: a2PhoneEntrance,
            }}
          >
            <Phone3D
              width={540}
              height={1100}
              rotX={interpolate(act2Frame, [0, 140], [10, 0])}
              rotY={interpolate(act2Frame, [0, 140], [-10, 0])}
              scale={interpolate(act2Frame, [0, 140], [0.98, 1.05])}
              shadowIntensity={1.2}
              screenScrollY={a2ScrollY}
              screenContent={
                <Img
                  src={staticFile('footage_en/mobile_frontpage_long.png')}
                  style={{
                    width: '100%',
                    display: 'block',
                  }}
                />
              }
            />

            {/* Floating Luxury Pill 1 (Left) */}
            {a2Badge1 > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  left: 10,
                  bottom: 140,
                  backgroundColor: '#ffffff',
                  borderRadius: 18,
                  border: C.border,
                  padding: '24px 26px',
                  boxShadow: C.cardShadow,
                  transform: `scale(${a2Badge1}) translateY(${interpolate(a2Badge1, [0, 1], [30, 0])}px)`,
                  zIndex: 80,
                  maxWidth: 320,
                }}
              >
                <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: C.red, fontWeight: 700 }}>
                  VERIFIED FACT PIPELINE
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginTop: 4 }}>
                  Zero sensationalism.
                </div>
                <div style={{ fontSize: 14, color: C.inkSubtle, marginTop: 4 }}>
                  No algorithm altering your feed.
                </div>
              </div>
            )}

            {/* Floating Luxury Pill 2 (Right) */}
            {a2Badge2 > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 160,
                  backgroundColor: C.ink,
                  color: '#ffffff',
                  borderRadius: 18,
                  padding: '24px 26px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                  transform: `scale(${a2Badge2}) translateY(${interpolate(a2Badge2, [0, 1], [-30, 0])}px)`,
                  zIndex: 80,
                  maxWidth: 320,
                }}
              >
                <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', opacity: 0.7, fontWeight: 700 }}>
                  PURE READABILITY
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                  100% Free Forever.
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                  No ads. No paywalls. No tracking.
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footnote */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: C.border,
              paddingTop: 18,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              color: C.inkSubtle,
            }}
          >
            <span>plain-news.ch</span>
            <span>BUILT ON 5 NON-NEGOTIABLE PRINCIPLES</span>
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 3: THE 5 PRINCIPLES — ARCHITECTURAL SUITE (280 - 705) */}
      {/* =========================================================== */}
      {isAct3 && (
        <AbsoluteFill className="paper-texture" style={{ padding: '60px 55px', display: 'flex', flexDirection: 'column' }}>
          {/* Top Bar */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: C.borderBold,
                paddingBottom: 16,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16,
                letterSpacing: 2,
                fontWeight: 700,
              }}
            >
              <span>PLAIN · 5 CORE PRINCIPLES</span>
              <span style={{ color: C.red }}>● {currentPrinciple.index} / 05</span>
            </div>

            {/* Principle Header Block - Grand Monumental Proportions */}
            <div
              style={{
                marginTop: 26,
                borderBottom: C.border,
                paddingBottom: 22,
                opacity: cardEntrance,
                transform: `translateY(${interpolate(cardEntrance, [0, 1], [25, 0])}px)`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    backgroundColor: C.red,
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 800,
                    letterSpacing: 1.5,
                  }}
                >
                  PRINCIPLE {currentPrinciple.index} / 05
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    color: C.inkSubtle,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                  }}
                >
                  {currentPrinciple.category}
                </span>
              </div>

              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 76,
                  fontWeight: 900,
                  lineHeight: 1.0,
                  letterSpacing: '-0.04em',
                  color: C.ink,
                  marginTop: 12,
                }}
              >
                <span style={{ color: C.red, fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', marginRight: 16 }}>
                  {currentPrinciple.index}.
                </span>
                {currentPrinciple.title}
              </div>

              <div
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 34,
                  fontStyle: 'italic',
                  color: C.inkMuted,
                  marginTop: 10,
                  lineHeight: 1.3,
                }}
              >
                {currentPrinciple.subtitle}
              </div>

              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 22,
                  lineHeight: 1.45,
                  color: C.inkSubtle,
                  marginTop: 12,
                }}
              >
                {currentPrinciple.dek}
              </div>
            </div>
          </div>

          {/* Central Visual Component Showcase (Individual Kinetic Motion Transitions) */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              margin: '25px 0',
              overflow: 'visible',
            }}
          >
            {currentPrinciple.renderVisual(pLocalFrame, fps)}
          </div>

          {/* Bottom Stepper Progress Bar */}
          <div style={{ marginTop: 'auto' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                color: C.inkSubtle,
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              <span>PILLAR PROGRESSION</span>
              <span>{currentPIndex + 1} OF 5 PILLARS</span>
            </div>
            <div style={{ display: 'flex', gap: 10, height: 8 }}>
              {[0, 1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    backgroundColor:
                      idx === currentPIndex
                        ? C.red
                        : idx < currentPIndex
                        ? C.ink
                        : 'rgba(11, 12, 14, 0.15)',
                    borderRadius: 4,
                  }}
                />
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 18,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: C.inkSubtle,
              }}
            >
              <span>plain-news.ch</span>
              <span>FOUNDED BY SIMON EGGERT · OPEN SOURCE</span>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 4: THE MONUMENTAL CTA (705 - 900) */}
      {/* =========================================================== */}
      {isAct4 && (
        <AbsoluteFill className="paper-texture" style={{ padding: '60px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {/* Top Swiss Header */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: C.borderBold,
                paddingBottom: 16,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16,
                letterSpacing: 2,
                fontWeight: 700,
              }}
            >
              <span>PLAIN · THE INDEPENDENT NEWSROOM</span>
              <span style={{ color: C.red }}>● 04 / 04</span>
            </div>

            {/* Monumental Headline */}
            <div
              style={{
                marginTop: 24,
                textAlign: 'center',
                opacity: a4Entrance,
                transform: `translateY(${interpolate(a4Entrance, [0, 1], [30, 0])}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 88,
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  lineHeight: 0.95,
                  color: C.ink,
                  textTransform: 'uppercase',
                }}
              >
                Turn off the noise.
              </div>
              <div
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 38,
                  fontStyle: 'italic',
                  color: C.inkMuted,
                  marginTop: 12,
                }}
              >
                Read the first real news of your life.
              </div>
            </div>
          </div>

          {/* High-End Broadsheet Display Mockup with Realistic Browser Chrome & Shadow */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 840,
              margin: '20px 0',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 40px 100px -20px rgba(0,0,0,0.35), 0 0 0 2px rgba(11,12,14,0.14)',
              opacity: a4DeviceSpring,
              transform: `scale(${interpolate(a4DeviceSpring, [0, 1], [0.94, 1])})`,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#fff',
            }}
          >
            {/* Browser Chrome Header */}
            <div
              style={{
                height: 46,
                backgroundColor: '#ede8dd',
                borderBottom: '1px solid rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 18px',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 7 }}>
                <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#ff5f57' }} />
                <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#febc2e' }} />
                <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#28c840' }} />
              </div>
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#ffffff',
                  height: 30,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  color: C.inkSubtle,
                  letterSpacing: 1,
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                https://plain-news.ch
              </div>
            </div>

            {/* Broadsheet Screenshot */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <Img
                src={staticFile('footage_en/desktop_broadsheet_en.png')}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top center',
                }}
              />
              {/* Subtle Gradient Fog at bottom */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, transparent 65%, rgba(244,239,230,0.95) 100%)',
                }}
              />
            </div>
          </div>

          {/* Luxury CTA Card */}
          <div>
            <div
              style={{
                backgroundColor: C.ink,
                borderRadius: 24,
                padding: '40px 42px',
                textAlign: 'center',
                color: '#ffffff',
                boxShadow: '0 25px 65px rgba(0,0,0,0.35)',
                opacity: a4CardSpring,
                transform: `scale(${interpolate(a4CardSpring, [0, 1], [0.92, 1])})`,
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: C.red,
                  color: '#fff',
                  padding: '6px 18px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 800,
                  letterSpacing: 2,
                  marginBottom: 16,
                }}
              >
                100% FREE · NO SUBSCRIPTION EVER
              </div>

              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 76,
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  color: '#ffffff',
                }}
              >
                plain-news.ch
              </div>

              <div
                style={{
                  marginTop: 18,
                  fontSize: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: 1.5,
                }}
              >
                OPEN DIRECTLY IN YOUR BROWSER · NO APP NEEDED
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: 1.5,
                }}
              >
                9 LANGUAGES IN REAL-TIME · 100% UNBIASED · OPEN SOURCE
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 18,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: C.inkSubtle,
              }}
            >
              <span>FOUNDED BY SIMON EGGERT</span>
              <span>RADICAL OBJECTIVITY</span>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Cinematic White Flash at Cut into Plain (Frames 137 - 146) */}
      {cutFlash > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: '#ffffff',
            opacity: cutFlash,
            pointerEvents: 'none',
            zIndex: 999,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
