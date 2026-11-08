import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  OffthreadVideo,
  Sequence,
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
// PLAIN FLOW COMMERCIAL (GOOGLE FLOW LIVE FOOTAGE + REAL UI + MOTION)
// =====================================================================
export const PlainFlowAd = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
    cardShadow: '0 20px 50px -15px rgba(20, 18, 14, 0.16), 0 10px 20px -8px rgba(20, 18, 14, 0.1)',
  };

  // Timeline (900 frames = 30.0s @ 30fps)
  const isAct1 = frame < 140;
  const isAct2 = frame >= 140 && frame < 280;
  const isAct3 = frame >= 280 && frame < 705;
  const isAct4 = frame >= 705;

  const cutFlash = interpolate(frame, [137, 140, 146], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // =============================================================
  // ACT 1: KINETIC HOOK + GOOGLE FLOW RAINY NEON COMMUTER
  // =============================================================
  const title1Spring = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 180 } });
  const anxiousSpring = spring({ frame: frame - 18, fps, config: { damping: 12, stiffness: 220 } });
  const subSpring = spring({ frame: frame - 55, fps, config: { damping: 15, stiffness: 160 } });

  const a1PhoneRotX = interpolate(frame, [0, 138], [14, 4]);
  const a1PhoneRotY = interpolate(frame, [0, 138], [-16, -5]);
  const a1PhoneScale = interpolate(frame, [0, 138], [0.84, 0.94]);

  const jitterIntensity = frame > 65 ? interpolate(frame, [65, 138], [0, 8]) : 0;
  const jitterX = Math.sin(frame * 4.2) * jitterIntensity;
  const jitterY = Math.cos(frame * 5.1) * jitterIntensity;

  const notif1 = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 200 } });
  const notif2 = spring({ frame: frame - 68, fps, config: { damping: 12, stiffness: 200 } });
  const paywallModal = spring({ frame: frame - 92, fps, config: { damping: 11, stiffness: 190 } });
  const truthStamp = spring({ frame: frame - 116, fps, config: { damping: 10, stiffness: 240 } });

  // =============================================================
  // ACT 2: ENTER PLAIN — GOOGLE FLOW MORNING SUNLIGHT + REAL UI
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
  // ACT 3: THE 5 PRINCIPLES + GOOGLE FLOW NEWSROOM STUDIO
  // =============================================================
  const act3Frame = Math.max(0, frame - 280);
  const currentPIndex = Math.min(4, Math.max(0, Math.floor(act3Frame / 85)));
  const pLocalFrame = act3Frame % 85;

  const cardEntrance = spring({
    frame: pLocalFrame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const principles = [
    {
      index: '01',
      category: 'RADICAL OBJECTIVITY',
      title: 'ZERO SPIN',
      subtitle: 'Pure verified events. Zero emotional manipulation.',
      dek: 'No speculation, no loaded adjectives, no sensationalist outrage. Every story is reduced to verified facts, hard metrics, and authenticated direct quotes.',
      renderVisual: (pFrame = 0) => {
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
              gap: 20,
              width: '100%',
              transform: `translateX(${p1ExitX}px)`,
              opacity: p1ExitOpacity,
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: 24,
                border: '2px solid rgba(220, 38, 38, 0.4)',
                padding: '32px 36px',
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
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: C.red,
                      fontSize: 13,
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
                      fontSize: 31,
                      lineHeight: 1.35,
                      color: '#716e65',
                      fontWeight: 600,
                    }}
                  >
                    "Disastrous bill sparks furious civil backlash as democracy collapses in total chaos!"
                  </div>
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
                  marginTop: 16,
                  display: 'flex',
                  gap: 20,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: C.red,
                  fontWeight: 700,
                }}
              >
                <span>✕ 3 LOADED ADJECTIVES REMOVED</span>
                <span>✕ APOCALYPTIC FRAMING PURGED</span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}
            >
              <div style={{ height: 1.5, flex: 1, backgroundColor: 'rgba(11, 12, 14, 0.18)' }} />
              <div
                style={{
                  backgroundColor: C.ink,
                  color: '#ffffff',
                  padding: '8px 22px',
                  borderRadius: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                }}
              >
                PLAIN RADICAL OBJECTIVITY FILTER ▼
              </div>
              <div style={{ height: 1.5, flex: 1, backgroundColor: 'rgba(11, 12, 14, 0.18)' }} />
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 24,
                border: '3.5px solid #0b0c0e',
                padding: '34px 36px',
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
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: C.ink,
                      fontSize: 14,
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
                    fontSize: 35,
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
                  marginTop: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 18px',
                  backgroundColor: 'rgba(11, 12, 14, 0.05)',
                  border: '1.5px solid rgba(11, 12, 14, 0.12)',
                  borderRadius: 20,
                  color: C.ink,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  alignSelf: 'flex-start',
                }}
              >
                ✓ PRIMARY DATA ONLY · ZERO EMOTIONAL DISTORTION
              </div>
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
              gap: 20,
              width: '100%',
              transform: `translateY(${p2ExitY}px)`,
              opacity: p2ExitOpacity,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: 24,
                  border: C.border,
                  padding: '34px 30px',
                  height: 360,
                  boxShadow: C.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transform: `translateX(${wire1Slide}px)`,
                }}
              >
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.inkSubtle }}>
                    PRIMARY WIRE · 08:14 UTC
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 48, fontWeight: 700, margin: '10px 0 12px', color: C.ink }}>
                    Reuters
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      color: C.ink,
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: "'JetBrains Mono', monospace",
                      backgroundColor: 'rgba(11, 12, 14, 0.06)',
                      padding: '5px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.red }} />
                    VERIFIED FACT RECORD
                  </div>
                </div>
                <div style={{ fontSize: 17, color: C.inkMuted, lineHeight: 1.45 }}>
                  Primary legislative roll call and official transcript confirmed by parliamentary desk.
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: 24,
                  border: C.border,
                  padding: '34px 30px',
                  height: 360,
                  boxShadow: C.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transform: `translateX(${wire2Slide}px)`,
                }}
              >
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.inkSubtle }}>
                    SECONDARY WIRE · 08:16 UTC
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 48, fontWeight: 700, margin: '10px 0 12px', color: C.ink }}>
                    AP News
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      color: C.ink,
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: "'JetBrains Mono', monospace",
                      backgroundColor: 'rgba(11, 12, 14, 0.06)',
                      padding: '5px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.red }} />
                    CROSS-CORROBORATED
                  </div>
                </div>
                <div style={{ fontSize: 17, color: C.inkMuted, lineHeight: 1.45 }}>
                  Independent newsroom correspondent validated voting margin and quorum protocol on-site.
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: C.ink,
                borderRadius: 22,
                padding: '30px 34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                transform: `scale(${interpolate(sealImpact, [0, 1], [0.85, 1])})`,
                opacity: sealImpact,
              }}
            >
              <div>
                <div style={{ color: '#ffffff', fontSize: 24, fontWeight: 800 }}>
                  Automatic Dual-Wire Corroboration Seal
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>
                  Zero unverified single-source claims enter the feed.
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
                CORROBORATED
              </div>
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
              gap: 16,
              width: '100%',
              transform: `scale(${p3ExitScale})`,
              opacity: p3ExitOpacity,
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: 22,
                border: C.border,
                padding: '24px 30px',
                borderLeft: '10px solid #0b0c0e',
                boxShadow: C.cardShadow,
                opacity: p3Entrance,
                transform: `translateX(${interpolate(p3Entrance, [0, 1], [-80, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.ink, fontWeight: 800 }}>
                  LEFT-LEANING NARRATIVE LENS:
                </div>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.ink, backgroundColor: 'rgba(11, 12, 14, 0.08)', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                  EMOTIONAL BIAS: 84%
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
                "Historic progressive triumph transforms national economy and uplifts working families."
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: 22,
                border: C.border,
                padding: '24px 30px',
                borderLeft: `10px solid ${C.red}`,
                boxShadow: C.cardShadow,
                opacity: p3Entrance,
                transform: `translateX(${interpolate(p3Entrance, [0, 1], [80, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.red, fontWeight: 800 }}>
                  RIGHT-LEANING NARRATIVE LENS:
                </div>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.red, backgroundColor: 'rgba(220, 38, 38, 0.08)', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                  EMOTIONAL BIAS: 91%
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
                "Reckless federal spending package fuels national debt and ignites inflation crisis."
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 24,
                border: '3.5px solid #0b0c0e',
                padding: '26px 32px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
                opacity: p3CenterPunch,
                transform: `scale(${interpolate(p3CenterPunch, [0, 1], [0.92, 1])})`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                <div
                  style={{
                    backgroundColor: C.ink,
                    color: '#ffffff',
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 900,
                    letterSpacing: 1,
                  }}
                >
                  PLAIN SYNTHESIS
                </div>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.ink, fontWeight: 800 }}>
                  ● 100% FACTUAL RECONSTRUCTION
                </div>
              </div>
              <div style={{ fontSize: 25, fontWeight: 800, color: C.ink, lineHeight: 1.3 }}>
                "Senate approves $1.2T infrastructure bill 51 to 49 following 8-hour committee session."
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
        const tileItems = [
          { val: '0', label: 'ADVERTISEMENTS', desc: 'No sponsored articles, no banner injections.' },
          { val: '0', label: 'PAYWALLS', desc: 'Completely open for all 8 billion humans.' },
          { val: '0', label: 'TRACKING COOKIES', desc: 'Zero analytics pixels or surveillance.' },
          { val: '0', label: 'SUBSCRIPTIONS', desc: 'No credit cards required. Free forever.' },
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
              gap: 18,
              width: '100%',
              transform: `translateX(${p4ExitX}px)`,
              opacity: p4ExitOpacity,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
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
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      borderRadius: 22,
                      border: C.border,
                      padding: '28px 26px',
                      height: 245,
                      boxShadow: C.cardShadow,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: beatSpring,
                      transform: `scale(${interpolate(beatSpring, [0, 1], [0.85, 1])}) translateY(${interpolate(beatSpring, [0, 1], [40, 0])}px)`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 78, fontWeight: 900, color: C.red, fontFamily: "'Inter', sans-serif", lineHeight: 0.9 }}>
                        {item.val}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, fontFamily: "'JetBrains Mono', monospace", marginTop: 10 }}>
                        {item.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 15, color: C.inkSubtle, lineHeight: 1.4 }}>
                      {item.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: '24px 34px',
                borderLeft: '8px solid #0b0c0e',
                border: C.border,
                boxShadow: C.cardShadow,
                opacity: spring({ frame: pFrame - 28, fps: 30, config: { damping: 14, stiffness: 180 } }),
              }}
            >
              <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 25, color: C.ink, lineHeight: 1.3 }}>
                "Information is a public utility, not an attention casino."
              </div>
              <div style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: C.inkSubtle, marginTop: 8, fontWeight: 700 }}>
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
              gap: 16,
              width: '100%',
              transform: `scale(${p5ExitScale})`,
              opacity: p5ExitOpacity,
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: 22,
                border: C.border,
                padding: '24px 30px',
                boxShadow: C.cardShadow,
                opacity: reporterDrop,
                transform: `translateY(${interpolate(reporterDrop, [0, 1], [-40, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.inkSubtle, fontWeight: 700 }}>
                    STAGE 01 · WIRE INGESTION & FACT SYNTHESIS
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.ink, marginTop: 4 }}>
                    Autonomous AI Reporter
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: C.ink,
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 900,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 1.5,
                  }}
                >
                  REPORTER
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  backgroundColor: 'rgba(11, 12, 14, 0.04)',
                  borderRadius: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: C.inkSubtle }}>WIRES: Reuters (08:14 UTC) + AP (08:16 UTC)</span>
                <span style={{ color: C.ink, fontWeight: 700 }}>✓ 18 immutable data points</span>
              </div>
            </div>

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
                  padding: '8px 20px',
                  borderRadius: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                }}
              >
                ADVERSARIAL CROSS-EXAMINATION PROTOCOL ▼
              </div>
              <div style={{ height: 2, flex: 1, backgroundColor: 'rgba(220, 38, 38, 0.25)' }} />
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 22,
                border: '3px solid #dc2626',
                padding: '24px 30px',
                boxShadow: '0 20px 50px -10px rgba(220, 38, 38, 0.16)',
                opacity: auditorRise,
                transform: `translateY(${interpolate(auditorRise, [0, 1], [40, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.red, fontWeight: 800 }}>
                    STAGE 02 · RUTHLESS ADVERSARIAL CROSS-EXAMINATION
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.ink, marginTop: 4 }}>
                    Adversarial AI Auditor
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: C.red,
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 900,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 1.5,
                  }}
                >
                  AUDITOR
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  backgroundColor: 'rgba(220, 38, 38, 0.05)',
                  borderRadius: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: C.red, fontWeight: 700 }}>AUDIT: 2 speculative adjectives challenged</span>
                <span style={{ color: C.ink, fontWeight: 700 }}>✓ Replaced with factual metrics</span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: C.ink,
                borderRadius: 16,
                padding: '16px 24px',
                textAlign: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14,
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
          </div>
        );
      },
    },
  ];

  const currentPrinciple = principles[currentPIndex];

  // =============================================================
  // ACT 4: THE MONUMENTAL CTA + GOOGLE FLOW STUDIO + REAL DESKTOP
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

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,600&family=JetBrains+Mono:wght@500;600;700;800&display=swap');
          * { box-sizing: border-box; }
          .paper-texture {
            background-color: #f4efe6;
            background-image: radial-gradient(rgba(11, 12, 14, 0.035) 1px, transparent 1px);
            background-size: 24px 24px;
          }
        `}
      </style>

      {/* =========================================================== */}
      {/* ACT 1: KINETIC HOOK + GOOGLE FLOW LIVE-ACTION RAINY CITY    */}
      {/* =========================================================== */}
      {isAct1 && (
        <AbsoluteFill
          style={{
            backgroundColor: '#09090b',
            transform: `translate(${jitterX}px, ${jitterY}px)`,
          }}
        >
          {/* Full-bleed Google Flow Live-Action Cinema Clip 1 */}
          <Sequence from={0} durationInFrames={140}>
            <OffthreadVideo
              src={staticFile('footage/flow/plain-ad-noise-hook.mp4')}
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'contrast(1.12) brightness(0.68) saturate(1.15)',
              }}
            />
          </Sequence>

          {/* Cinematic Vignette & Gradient Scrim */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(9,9,11,0.88) 0%, rgba(9,9,11,0.45) 38%, rgba(9,9,11,0.72) 72%, rgba(9,9,11,0.94) 100%)',
            }}
          />

          {/* Foreground Kinetic Layout */}
          <AbsoluteFill
            style={{
              padding: '64px 55px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Top Telemetry Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                paddingBottom: 18,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15,
                letterSpacing: 2,
                color: 'rgba(255, 255, 255, 0.85)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: C.red, boxShadow: '0 0 12px #ef4444' }} />
                INVESTIGATION: THE ATTENTION ECONOMY
              </span>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: 6 }}>
                GOOGLE FLOW · 01 / 04
              </span>
            </div>

            {/* Kinetic Typography Question */}
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 66,
                  fontWeight: 900,
                  lineHeight: 1.04,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  textShadow: '0 12px 32px rgba(0,0,0,0.85)',
                  opacity: title1Spring,
                  transform: `translateY(${interpolate(title1Spring, [0, 1], [30, 0])}px)`,
                }}
              >
                Why are you always{' '}
                <span
                  style={{
                    color: '#ef4444',
                    textShadow: '0 0 40px rgba(239, 68, 68, 0.75)',
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
                  marginTop: 20,
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 30,
                  fontStyle: 'italic',
                  color: 'rgba(255, 255, 255, 0.9)',
                  lineHeight: 1.35,
                  textShadow: '0 6px 20px rgba(0,0,0,0.9)',
                  opacity: subSpring,
                  transform: `translateY(${interpolate(subSpring, [0, 1], [20, 0])}px)`,
                }}
              >
                Because modern media does not want to inform you.
                <br />
                <strong style={{ color: '#ffffff', fontStyle: 'normal', fontWeight: 700 }}>
                  They monetize your panic and rage.
                </strong>
              </div>
            </div>

            {/* 3D Phone + Floating Clickbait / Paywall Overlays over Live-Action Commuter */}
            <div
              style={{
                position: 'relative',
                height: 960,
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
                shadowIntensity={1.25}
                screenContent={
                  <OffthreadVideo
                    src={staticFile('footage/flow/plain-ad-noise-hook.mp4')}
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                }
              />

              {notif1 > 0.05 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 90,
                    left: 25,
                    right: 25,
                    backgroundColor: 'rgba(15, 15, 18, 0.95)',
                    borderRadius: 20,
                    border: '1.5px solid rgba(239, 68, 68, 0.55)',
                    padding: '22px 26px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(239, 68, 68, 0.25)',
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

              {notif2 > 0.05 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 310,
                    left: 18,
                    right: 18,
                    backgroundColor: 'rgba(20, 20, 24, 0.96)',
                    borderRadius: 20,
                    border: '1.5px solid rgba(255, 255, 255, 0.2)',
                    padding: '22px 26px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
                    transform: `scale(${notif2}) rotate(2deg)`,
                    zIndex: 45,
                  }}
                >
                  <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                    PRIVACY BREACH WARNING
                  </div>
                  <div style={{ fontSize: 21, fontWeight: 700, color: '#fff', marginTop: 6, lineHeight: 1.3 }}>
                    842 behavioral advertisers are currently tracking your location and read history.
                  </div>
                </div>
              )}

              {paywallModal > 0.05 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 530,
                    left: 35,
                    right: 35,
                    backgroundColor: '#ffffff',
                    borderRadius: 22,
                    padding: '26px 28px',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
                    transform: `scale(${paywallModal}) rotate(-1deg)`,
                    zIndex: 50,
                    color: '#000',
                  }}
                >
                  <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#ef4444', fontWeight: 800 }}>
                    PAYWALL RESTRICTION
                  </div>
                  <div style={{ fontSize: 25, fontWeight: 900, marginTop: 8, lineHeight: 1.2 }}>
                    You have read 0 of 0 free articles. Pay $29.99/mo to continue.
                  </div>
                  <div
                    style={{
                      marginTop: 16,
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      borderRadius: 12,
                      padding: '13px',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    SUBSCRIBE OR LEAVE
                  </div>
                </div>
              )}

              {truthStamp > 0.05 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '39%',
                    left: '4%',
                    right: '4%',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    borderRadius: 20,
                    padding: '36px 30px',
                    boxShadow: '0 30px 90px rgba(220, 38, 38, 0.7), 0 0 0 4px #ffffff',
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

            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15,
                color: 'rgba(255,255,255,0.65)',
                textAlign: 'center',
                letterSpacing: 2,
              }}
            >
              PREPARE FOR THE RADICAL ANTIDOTE
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 2: ENTER PLAIN — GOOGLE FLOW MORNING SUNLIGHT + REAL UI */}
      {/* =========================================================== */}
      {isAct2 && (
        <AbsoluteFill className="paper-texture" style={{ padding: '55px 50px' }}>
          {/* Subtle Warm Morning Cinema Backdrop Window (Top Hero Strip) */}
          <div
            style={{
              position: 'absolute',
              top: 225,
              left: 50,
              right: 50,
              height: 320,
              borderRadius: 24,
              overflow: 'hidden',
              border: '2px solid rgba(11,12,14,0.18)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
              zIndex: 1,
            }}
          >
            <Sequence from={140} durationInFrames={140}>
              <OffthreadVideo
                src={staticFile('footage/flow/plain-ad-morning-clarity.mp4')}
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 55%',
                }}
              />
            </Sequence>
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 20,
                backgroundColor: 'rgba(11,12,14,0.82)',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 12,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.5,
              }}
            >
              ● ZURICH MORNING EDITION · LIVE CINEMA
            </div>
          </div>

          {/* Top Swiss Editorial Header */}
          <div
            style={{
              position: 'relative',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: C.borderBold,
              paddingBottom: 14,
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
              position: 'relative',
              zIndex: 10,
              marginTop: 20,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              borderBottom: C.border,
              paddingBottom: 18,
              opacity: a2IntroSpring,
              transform: `translateY(${interpolate(a2IntroSpring, [0, 1], [25, 0])}px)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 100,
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
                  fontSize: 40,
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
              zIndex: 20,
              height: 1040,
              width: '100%',
              marginTop: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: a2PhoneEntrance,
            }}
          >
            <Phone3D
              width={520}
              height={1060}
              rotX={interpolate(act2Frame, [0, 140], [10, 0])}
              rotY={interpolate(act2Frame, [0, 140], [-10, 0])}
              scale={interpolate(act2Frame, [0, 140], [0.96, 1.02])}
              shadowIntensity={1.25}
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

            {a2Badge1 > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  left: 6,
                  bottom: 150,
                  backgroundColor: '#ffffff',
                  borderRadius: 18,
                  border: C.border,
                  padding: '22px 24px',
                  boxShadow: C.cardShadow,
                  transform: `scale(${a2Badge1}) translateY(${interpolate(a2Badge1, [0, 1], [30, 0])}px)`,
                  zIndex: 80,
                  maxWidth: 310,
                }}
              >
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.red, fontWeight: 700 }}>
                  VERIFIED FACT PIPELINE
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, color: C.ink, marginTop: 4 }}>
                  Zero sensationalism.
                </div>
                <div style={{ fontSize: 14, color: C.inkSubtle, marginTop: 4 }}>
                  No algorithm altering your feed.
                </div>
              </div>
            )}

            {a2Badge2 > 0.05 && (
              <div
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 140,
                  backgroundColor: C.ink,
                  color: '#ffffff',
                  borderRadius: 18,
                  padding: '22px 24px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                  transform: `scale(${a2Badge2}) translateY(${interpolate(a2Badge2, [0, 1], [-30, 0])}px)`,
                  zIndex: 80,
                  maxWidth: 310,
                }}
              >
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', opacity: 0.7, fontWeight: 700 }}>
                  PURE READABILITY
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>
                  100% Free Forever.
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                  No ads. No paywalls. No tracking.
                </div>
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* =========================================================== */}
      {/* ACT 3: THE 5 PRINCIPLES + GOOGLE FLOW NEWSROOM STUDIO       */}
      {/* =========================================================== */}
      {isAct3 && (
        <AbsoluteFill className="paper-texture" style={{ padding: '55px 55px', display: 'flex', flexDirection: 'column' }}>
          {/* Top Bar */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: C.borderBold,
                paddingBottom: 14,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16,
                letterSpacing: 2,
                fontWeight: 700,
              }}
            >
              <span>PLAIN · 5 CORE PRINCIPLES</span>
              <span style={{ color: C.red }}>● {currentPrinciple.index} / 05</span>
            </div>

            {/* Live-Action Newsroom Studio Strip (Google Flow Clip 3) */}
            <div
              style={{
                marginTop: 18,
                height: 200,
                borderRadius: 20,
                overflow: 'hidden',
                position: 'relative',
                border: '2px solid rgba(11,12,14,0.16)',
                boxShadow: '0 14px 34px rgba(0,0,0,0.1)',
              }}
            >
              <Sequence from={280 + currentPIndex * 85} durationInFrames={85}>
                <OffthreadVideo
                  src={staticFile('footage/flow/plain-ad-newsroom-wires.mp4')}
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center 45%',
                  }}
                />
              </Sequence>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, rgba(11,12,14,0.78) 0%, rgba(11,12,14,0.25) 60%, rgba(11,12,14,0.65) 100%)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  padding: '16px 22px',
                }}
              >
                <span
                  style={{
                    backgroundColor: C.red,
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: 13,
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
                    fontSize: 13,
                    color: '#ffffff',
                    fontWeight: 700,
                    letterSpacing: 1.5,
                  }}
                >
                  {currentPrinciple.category}
                </span>
              </div>
            </div>

            {/* Principle Header Block */}
            <div
              style={{
                marginTop: 20,
                borderBottom: C.border,
                paddingBottom: 18,
                opacity: cardEntrance,
                transform: `translateY(${interpolate(cardEntrance, [0, 1], [25, 0])}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 70,
                  fontWeight: 900,
                  lineHeight: 1.0,
                  letterSpacing: '-0.04em',
                  color: C.ink,
                }}
              >
                <span style={{ color: C.red, fontFamily: "'Newsreader', Georgia, serif", fontStyle: 'italic', marginRight: 14 }}>
                  {currentPrinciple.index}.
                </span>
                {currentPrinciple.title}
              </div>

              <div
                style={{
                  fontFamily: "'Newsreader', Georgia, serif",
                  fontSize: 31,
                  fontStyle: 'italic',
                  color: C.inkMuted,
                  marginTop: 8,
                  lineHeight: 1.25,
                }}
              >
                {currentPrinciple.subtitle}
              </div>

              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 20,
                  lineHeight: 1.4,
                  color: C.inkSubtle,
                  marginTop: 10,
                }}
              >
                {currentPrinciple.dek}
              </div>
            </div>
          </div>

          {/* Central Visual Component Showcase */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              margin: '18px 0',
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
                marginBottom: 10,
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
                paddingTop: 16,
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
      {/* ACT 4: THE MONUMENTAL CTA + GOOGLE FLOW + REAL BROADSHEET   */}
      {/* =========================================================== */}
      {isAct4 && (
        <AbsoluteFill className="paper-texture" style={{ padding: '55px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: C.borderBold,
                paddingBottom: 14,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16,
                letterSpacing: 2,
                fontWeight: 700,
              }}
            >
              <span>PLAIN · THE INDEPENDENT NEWSROOM</span>
              <span style={{ color: C.red }}>● 04 / 04</span>
            </div>

            <div
              style={{
                marginTop: 22,
                textAlign: 'center',
                opacity: a4Entrance,
                transform: `translateY(${interpolate(a4Entrance, [0, 1], [30, 0])}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 84,
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
                  fontSize: 36,
                  fontStyle: 'italic',
                  color: C.inkMuted,
                  marginTop: 10,
                }}
              >
                Read the first real news of your life.
              </div>
            </div>
          </div>

          {/* High-End Broadsheet Display Mockup + Live Google Flow Picture-in-Picture */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 820,
              margin: '16px 0',
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

            {/* Broadsheet Screenshot + Live Google Flow Video Corner Card */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#f4efe6' }}>
              <Img
                src={staticFile('footage_en/desktop_broadsheet_en.png')}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              />

              {/* Live Google Flow Cinema Inset (Bottom Right) */}
              <div
                style={{
                  position: 'absolute',
                  right: 24,
                  bottom: 24,
                  width: 250,
                  height: 360,
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: '3px solid #0b0c0e',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
                  zIndex: 20,
                }}
              >
                <Sequence from={705} durationInFrames={195}>
                  <OffthreadVideo
                    src={staticFile('footage/flow/plain-ad-morning-clarity.mp4')}
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </Sequence>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                    right: 10,
                    backgroundColor: 'rgba(11,12,14,0.85)',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 800,
                    textAlign: 'center',
                    letterSpacing: 1,
                  }}
                >
                  CALM DAILY BRIEFING
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, transparent 70%, rgba(244,239,230,0.92) 100%)',
                  pointerEvents: 'none',
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
                padding: '38px 42px',
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
                  marginBottom: 14,
                }}
              >
                100% FREE · NO SUBSCRIPTION EVER
              </div>

              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 74,
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
                  marginTop: 16,
                  fontSize: 15,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'rgba(255,255,255,0.75)',
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
                  color: 'rgba(255,255,255,0.45)',
                  letterSpacing: 1.5,
                }}
              >
                9 LANGUAGES IN REAL-TIME · 100% UNBIASED · OPEN SOURCE
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 16,
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
