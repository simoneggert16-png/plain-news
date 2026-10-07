import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const PlainNewsReel = ({
  category = 'EILMELDUNG',
  title = 'Lionel Messi bestreitet letztes Länderspiel für Argentinien',
  dek = 'Abschied im Estadio Mâs Monumental mit 3:0-Sieg gegen Benin.',
  facts = [
    'Lionel Messi steuert zwei Vorlagen und ein Tor zum 3:0-Endstand bei.',
    'Über 84.000 Zuschauer verabschieden den Kapitän in Buenos Aires.',
    'Radikal faktenbasierte Berichterstattung auf plain-news.ch',
  ],
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Progress bar animation
  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: 'clamp',
  });

  // Entrance spring
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [0, 20], [40, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#F5F2EB', // PLAIN signature newspaper paper color
        color: '#111111',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        padding: '80px 60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Header Bar */}
      <div>
        {/* Progress Bar */}
        <div
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#DDD8CE',
            marginBottom: '40px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#c93b2b',
            }}
          />
        </div>

        {/* Brand & Badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #111111',
            paddingBottom: '24px',
            marginBottom: '50px',
          }}
        >
          <div
            style={{
              fontSize: '52px',
              fontWeight: '900',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            PLAIN.
          </div>
          <div
            style={{
              backgroundColor: '#c93b2b',
              color: '#FFFFFF',
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '22px',
              fontWeight: '800',
              padding: '6px 16px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {category}
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '68px',
              fontWeight: '700',
              lineHeight: 1.15,
              margin: '0 0 28px 0',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>

          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '34px',
              lineHeight: 1.4,
              color: '#444444',
              margin: '0 0 50px 0',
              fontStyle: 'italic',
            }}
          >
            {dek}
          </p>
        </div>

        {/* Key Facts Box */}
        <div
          style={{
            backgroundColor: '#EAE5DA',
            borderLeft: '6px solid #111111',
            padding: '36px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div
            style={{
              fontFamily: "'SF Mono', Menlo, monospace",
              fontSize: '20px',
              fontWeight: '800',
              letterSpacing: '0.12em',
              color: '#666666',
              textTransform: 'uppercase',
            }}
          >
            KORPUS & FAKTEN
          </div>

          {facts.map((fact, idx) => {
            const factEntrance = spring({
              frame: frame - 25 - idx * 12,
              fps,
              config: { damping: 14 },
            });
            const factOpacity = interpolate(factEntrance, [0, 1], [0, 1]);
            const factX = interpolate(factEntrance, [0, 1], [30, 0]);

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '20px',
                  opacity: factOpacity,
                  transform: `translateX(${factX}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'SF Mono', Menlo, monospace",
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#c93b2b',
                    lineHeight: '36px',
                  }}
                >
                  [{idx + 1}]
                </span>
                <span
                  style={{
                    fontSize: '30px',
                    lineHeight: 1.35,
                    fontWeight: '600',
                    color: '#111111',
                  }}
                >
                  {fact}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '2px solid #111111',
          paddingTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: "'SF Mono', Menlo, monospace",
          fontSize: '22px',
          color: '#555555',
        }}
      >
        <span>NACHRICHTEN OHNE LÄRM</span>
        <span style={{ fontWeight: '700', color: '#111111' }}>plain-news.ch</span>
      </div>
    </AbsoluteFill>
  );
};
