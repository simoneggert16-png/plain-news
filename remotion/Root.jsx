import React from 'react';
import { Composition } from 'remotion';
import { PlainNewsReel } from './PlainNewsReel';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="PlainNewsReel"
        component={PlainNewsReel}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          category: 'EILMELDUNG',
          title: 'Lionel Messi bestreitet letztes Länderspiel für Argentinien',
          dek: 'Abschied im Estadio Mâs Monumental mit 3:0-Sieg gegen Benin.',
          facts: [
            'Lionel Messi steuert zwei Vorlagen und ein Tor zum 3:0-Endstand bei.',
            'Über 84.000 Zuschauer verabschieden den Kapitän in Buenos Aires.',
            'Radikal faktenbasierte Berichterstattung auf plain-news.ch',
          ],
        }}
      />
    </>
  );
};
