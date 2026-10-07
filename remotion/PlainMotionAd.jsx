import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const PlainMotionAd = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ──────────────── SCENE TIMINGS (420 frames = 14s) ────────────────
  // Scene 1: The Noise & Hook (Frames 0 - 85)
  // Scene 2: The Transition & Manifesto (Frames 86 - 195)
  // Scene 3: The Live Product Experience (Frames 196 - 315)
  // Scene 4: The Climax & CTA (Frames 316 - 420)

  // Overall progress bar (top)
  const totalProgress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: frame < 85 ? '#0A0C0E' : '#F5F2EB',
        color: frame < 85 ? '#FFFFFF' : '#111111',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Audio Track */}
      <Audio
        src={staticFile('audio/ambient_tape_bed.m4a')}
        volume={(f) =>
          interpolate(f, [0, 30, durationInFrames - 30, durationInFrames], [0, 0.8, 0.8, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />

      {/* Global Top Progress Indicator */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          backgroundColor: frame < 85 ? '#222' : '#DDD8CE',
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${totalProgress}%`,
            backgroundColor: '#c93b2b',
          }}
        />
      </div>

      {/* ════════════════ SCENE 1: THE HOOK (0 - 85) ════════════════ */}
      {frame < 85 && <Scene1Hook frame={frame} fps={fps} />}

      {/* ════════════════ SCENE 2: THE MANIFESTO (85 - 195) ════════════════ */}
      {frame >= 85 && frame < 195 && <Scene2Manifesto frame={frame - 85} fps={fps} />}

      {/* ════════════════ SCENE 3: LIVE PRODUCT (195 - 315) ════════════════ */}
      {frame >= 195 && frame < 315 && <Scene3Product frame={frame - 195} fps={fps} />}

      {/* ════════════════ SCENE 4: CLIMAX & CTA (315 - 420) ════════════════ */}
      {frame >= 315 && <Scene4CTA frame={frame - 315} fps={fps} />}
    </AbsoluteFill>
  );
};

/* ─────────────────────────────────────────────────────────────
   SCENE 1: THE HOOK
   Brutalist, high contrast, red flash, crossing out media noise
   ───────────────────────────────────────────────────────────── */
function Scene1Hook({ frame, fps }) {
  // Shock headline entrance
  const hookScale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5 },
  });

  const redFlash = frame < 6 ? '#c93b2b' : '#0A0C0E';

  // Noise words crossing out
  const noiseItems = [
    { text: 'CLICKBAIT', delay: 24 },
    { text: '50 COOKIE-BANNER & POPUPS', delay: 36 },
    { text: 'ALGORITHMEN-HETZE', delay: 48 },
    { text: 'MEINUNG STATT FAKTEN', delay: 60 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: redFlash,
        padding: '120px 60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Warning Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#c93b2b',
            color: '#FFFFFF',
            fontFamily: "'SF Mono', Menlo, monospace",
            fontSize: '24px',
            fontWeight: '900',
            letterSpacing: '0.12em',
            padding: '8px 18px',
            textTransform: 'uppercase',
          }}
        >
          REALITY CHECK
        </div>
        <div
          style={{
            fontFamily: "'SF Mono', Menlo, monospace",
            fontSize: '22px',
            color: '#888888',
          }}
        >
          0.00s // MEDIA OVERLOAD
        </div>
      </div>

      {/* Main Provocation Headline */}
      <div
        style={{
          transform: `scale(${hookScale})`,
          transformOrigin: 'left center',
        }}
      >
        <div
          style={{
            fontFamily: "'SF Mono', Menlo, monospace",
            fontSize: '40px',
            fontWeight: '800',
            color: '#c93b2b',
            letterSpacing: '0.06em',
            marginBottom: '16px',
          }}
        >
          WARUM BIST DU NACH DEN NACHRICHTEN IMMER GESTRESST?
        </div>
        <div
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '84px',
            fontWeight: '900',
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            color: '#FFFFFF',
            textTransform: 'uppercase',
          }}
        >
          94% DER MEDIEN WOLLEN NUR DEINE WUT.
        </div>
      </div>

      {/* The Noise List (crossed out in red) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          margin: '20px 0',
        }}
      >
        {noiseItems.map((item, idx) => {
          const visible = frame >= item.delay;
          const strikeWidth = interpolate(frame - item.delay, [0, 8], [0, 100], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          if (!visible) return null;

          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                display: 'inline-block',
                alignSelf: 'flex-start',
                backgroundColor: '#16191D',
                border: '1px solid #2A3038',
                padding: '14px 24px',
              }}
            >
              <span
                style={{
                  fontFamily: "'SF Mono', Menlo, monospace",
                  fontSize: '32px',
                  fontWeight: '800',
                  color: '#999999',
                  letterSpacing: '0.05em',
                }}
              >
                {item.text}
              </span>
              {/* Red Cross-out Line */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  width: `${strikeWidth}%`,
                  height: '6px',
                  backgroundColor: '#c93b2b',
                  transform: 'translateY(-50%) rotate(-1.5deg)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom Pivot Line */}
      {frame >= 68 && (
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '44px',
            fontWeight: '700',
            color: '#FFFFFF',
            fontStyle: 'italic',
            borderTop: '1px solid #333333',
            paddingTop: '24px',
          }}
        >
          Es gibt eine andere Realität. →
        </div>
      )}
    </AbsoluteFill>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCENE 2: THE MANIFESTO
   Clean Swiss newspaper transition, Josef Müller-Brockmann layout
   ───────────────────────────────────────────────────────────── */
function Scene2Manifesto({ frame, fps }) {
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  const pillars = [
    {
      num: '01',
      title: '0% MEINUNG. 100% FAKTEN.',
      desc: 'Jede Meldung wird aus ≥ 2 unabhängigen Primärquellen verifiziert.',
      delay: 15,
    },
    {
      num: '02',
      title: 'NULL WERBUNG. NULL POPUPS.',
      desc: 'Keine Abos, keine Tracker, keine Banner. Völlig freier Zugang.',
      delay: 45,
    },
    {
      num: '03',
      title: 'IN 9 SPRACHEN IN ECHTZEIT.',
      desc: 'Von autonomen KI-Agenten rund um die Uhr neutral recherchiert.',
      delay: 75,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#F5F2EB',
        padding: '100px 60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Brand Header */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottom: '3px solid #111111',
            paddingBottom: '20px',
            marginBottom: '30px',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontSize: '88px',
                fontWeight: '900',
                letterSpacing: '-0.05em',
                lineHeight: 0.9,
                color: '#111111',
                transform: `scale(${logoScale})`,
                transformOrigin: 'left bottom',
              }}
            >
              PLAIN.
            </div>
            <div
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '32px',
                fontStyle: 'italic',
                color: '#555555',
                marginTop: '12px',
              }}
            >
              Nachrichten ohne Lärm.
            </div>
          </div>

          <div
            style={{
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '18px',
              fontWeight: '800',
              color: '#c93b2b',
              textAlign: 'right',
              letterSpacing: '0.08em',
            }}
          >
            RADIKAL MINIMAL<br />SCHWEIZER TYPOGRAFIE
          </div>
        </div>

        {/* Section Title */}
        <div
          style={{
            fontFamily: "'SF Mono', Menlo, monospace",
            fontSize: '22px',
            fontWeight: '900',
            letterSpacing: '0.14em',
            color: '#888888',
            marginBottom: '36px',
            textTransform: 'uppercase',
          }}
        >
          // DAS PLAIN MANIFEST
        </div>

        {/* The 3 Pillars */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {pillars.map((p, idx) => {
            const pillarSpring = spring({
              frame: frame - p.delay,
              fps,
              config: { damping: 15 },
            });
            const opacity = interpolate(pillarSpring, [0, 1], [0, 1]);
            const y = interpolate(pillarSpring, [0, 1], [30, 0]);

            return (
              <div
                key={idx}
                style={{
                  backgroundColor: '#ECE7DC',
                  border: '1.5px solid #111111',
                  boxShadow: '4px 4px 0px #111111',
                  padding: '28px 32px',
                  opacity,
                  transform: `translateY(${y}px)`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '10px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'SF Mono', Menlo, monospace",
                      fontSize: '26px',
                      fontWeight: '900',
                      color: '#c93b2b',
                    }}
                  >
                    [{p.num}]
                  </span>
                  <span
                    style={{
                      fontFamily: "'Helvetica Neue', Arial, sans-serif",
                      fontSize: '36px',
                      fontWeight: '900',
                      letterSpacing: '-0.02em',
                      color: '#111111',
                    }}
                  >
                    {p.title}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '26px',
                    lineHeight: 1.35,
                    color: '#444444',
                    paddingLeft: '62px',
                  }}
                >
                  {p.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid #CCCCCC',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: "'SF Mono', Menlo, monospace",
          fontSize: '20px',
          color: '#666666',
        }}
      >
        <span>ZERO SPIN · ZERO ADS</span>
        <span style={{ fontWeight: '800', color: '#111111' }}>plain-news.ch</span>
      </div>
    </AbsoluteFill>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCENE 3: LIVE PRODUCT & MATCH CENTER SHOWCASE
   Live score, ticker pulse, pure verified facts
   ───────────────────────────────────────────────────────────── */
function Scene3Product({ frame, fps }) {
  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 14 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#F5F2EB',
        padding: '90px 60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        {/* Category Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#c93b2b',
              }}
            />
            <span
              style={{
                fontFamily: "'SF Mono', Menlo, monospace",
                fontSize: '24px',
                fontWeight: '900',
                letterSpacing: '0.08em',
              }}
            >
              LIVE ECHTZEIT-NEWSROOM
            </span>
          </div>
          <span
            style={{
              backgroundColor: '#111111',
              color: '#FFFFFF',
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '18px',
              fontWeight: '800',
              padding: '4px 12px',
            }}
          >
            VERIFIZIERT
          </span>
        </div>

        {/* Interactive Match Center Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '2.5px solid #111111',
            boxShadow: '6px 6px 0px #111111',
            padding: '36px',
            marginBottom: '32px',
            transform: `scale(${cardSpring})`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '18px',
              color: '#666666',
              borderBottom: '1px solid #EEEEEE',
              paddingBottom: '12px',
              marginBottom: '20px',
            }}
          >
            <span>INTERNATIONAL FRIENDLY · MONUMENTAL</span>
            <span style={{ color: '#c93b2b', fontWeight: '800' }}>FT · 90'</span>
          </div>

          {/* Big Score */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontSize: '42px', fontWeight: '900' }}>Argentina</div>
            <div
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '68px',
                fontWeight: '900',
                letterSpacing: '0.05em',
              }}
            >
              3 : 0
            </div>
            <div style={{ fontSize: '42px', fontWeight: '900', color: '#666666' }}>Benin</div>
          </div>

          {/* Goalscorers & Assists */}
          <div
            style={{
              backgroundColor: '#F8F6F0',
              borderLeft: '4px solid #1b5e20',
              padding: '16px 20px',
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '20px',
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong style={{ color: '#1b5e20' }}>[TOR] 48'</strong> Otamendi · Vorlage: Lionel Messi
            </div>
            <div>
              <strong style={{ color: '#1b5e20' }}>[TOR] 61'</strong> Nico Paz · Vorlage: Lionel Messi
            </div>
            <div>
              <strong style={{ color: '#1b5e20' }}>[TOR] 71'</strong> Lionel Messi
            </div>
          </div>

          <div
            style={{
              marginTop: '18px',
              fontSize: '18px',
              fontFamily: "'SF Mono', Menlo, monospace",
              color: '#888888',
              textAlign: 'center',
            }}
          >
            Keine subjektiven Ratings · Reine Fakten via Opta & FIFA Feed
          </div>
        </div>

        {/* Live News Ticker Card */}
        <div
          style={{
            backgroundColor: '#ECE7DC',
            border: '2px solid #111111',
            padding: '28px 32px',
          }}
        >
          <div
            style={{
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '18px',
              color: '#c93b2b',
              fontWeight: '800',
              marginBottom: '8px',
            }}
          >
            05:00 EILMELDUNG · WISSENSCHAFT
          </div>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '36px',
              fontWeight: '700',
              lineHeight: 1.25,
              color: '#111111',
              marginBottom: '12px',
            }}
          >
            Nature publiziert Durchbruch in der Neutrino-Physik
          </div>
          <div
            style={{
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '18px',
              color: '#555555',
            }}
          >
            Quellen: Nature · Reuters · CERN Pressemitteilung (Verifiziert)
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '2px solid #111111',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: "'SF Mono', Menlo, monospace",
          fontSize: '22px',
          color: '#555555',
        }}
      >
        <span>AGENT-PIPELINE: ALLE 15 MIN FRISCHE STORIES</span>
        <span style={{ fontWeight: '800', color: '#111111' }}>plain-news.ch</span>
      </div>
    </AbsoluteFill>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCENE 4: THE CLIMAX & CALL TO ACTION
   Brutalist, memorable, unstoppable CTA
   ───────────────────────────────────────────────────────────── */
function Scene4CTA({ frame, fps }) {
  const ctaSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5 },
  });

  const pulse = Math.sin(frame * 0.15) * 4;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#111111',
        color: '#FFFFFF',
        padding: '120px 60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          fontFamily: "'SF Mono', Menlo, monospace",
          fontSize: '24px',
          fontWeight: '900',
          color: '#c93b2b',
          letterSpacing: '0.12em',
        }}
      >
        // DEIN NEUER STANDARD
      </div>

      {/* Central Statement */}
      <div
        style={{
          transform: `scale(${ctaSpring})`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '92px',
            fontWeight: '900',
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            marginBottom: '32px',
            textTransform: 'uppercase',
          }}
        >
          SCHALTE DEN<br />
          <span style={{ color: '#c93b2b' }}>LÄRM AB.</span>
        </div>

        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '38px',
            color: '#DDDDDD',
            lineHeight: 1.4,
            marginBottom: '60px',
            fontStyle: 'italic',
          }}
        >
          Lies heute die ersten echten Nachrichten deines Lebens.
        </div>

        {/* Big URL Box */}
        <div
          style={{
            backgroundColor: '#F5F2EB',
            color: '#111111',
            padding: '36px 40px',
            border: '4px solid #c93b2b',
            boxShadow: `0px 10px 40px rgba(201, 59, 43, 0.4)`,
            transform: `translateY(${pulse}px)`,
            display: 'inline-block',
          }}
        >
          <div
            style={{
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              fontSize: '64px',
              fontWeight: '900',
              letterSpacing: '-0.03em',
            }}
          >
            plain-news.ch
          </div>
          <div
            style={{
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '22px',
              fontWeight: '800',
              color: '#c93b2b',
              marginTop: '8px',
              letterSpacing: '0.08em',
            }}
          >
            JETZT KOSTENLOS IM BROWSER ÖFFNEN →
          </div>
        </div>
      </div>

      {/* Bottom Feature Badges */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          fontFamily: "'SF Mono', Menlo, monospace",
          fontSize: '20px',
          fontWeight: '800',
          color: '#888888',
        }}
      >
        <span>✓ 100% KOSTENLOS</span>
        <span>•</span>
        <span>✓ WERBEFREI</span>
        <span>•</span>
        <span>✓ KEINE APP NÖTIG</span>
      </div>
    </AbsoluteFill>
  );
}
