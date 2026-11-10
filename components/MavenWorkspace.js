'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const MAVEN_CONSOLE_URL =
  process.env.NEXT_PUBLIC_PLAIN_MAVEN_URL || 'https://plain-maven.vercel.app';

export default function MavenWorkspace({
  locale = 'de',
  initialStory = '',
  initialLat = '',
  initialLon = '',
  labels = {},
}) {
  const iframeRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [mavenTheme, setMavenTheme] = useState('obsidian');
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerData, setReaderData] = useState(null);

  const iframeSrc = useMemo(() => {
    const url = new URL(MAVEN_CONSOLE_URL);
    url.searchParams.set('locale', locale);
    url.searchParams.set('theme', 'obsidian');
    if (initialStory) url.searchParams.set('story', initialStory);
    if (initialLat && initialLon) {
      url.searchParams.set('lat', String(initialLat));
      url.searchParams.set('lon', String(initialLon));
    }
    return url.toString();
  }, [locale, initialStory, initialLat, initialLon]);

  useEffect(() => {
    function onMessage(event) {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'plain-maven:selected' && msg.slug) {
        try {
          const next = new URL(window.location.href);
          next.searchParams.set('story', String(msg.slug));
          window.history.replaceState({}, '', next.toString());
        } catch {
          // ignore URL sync errors
        }
      } else if (msg.type === 'plain-maven:theme-changed' && msg.theme) {
        setMavenTheme(msg.theme === 'paper' ? 'paper' : 'obsidian');
      } else if (msg.type === 'plain-maven:open-article' && msg.slug) {
        setReaderOpen(true);
        setReaderLoading(true);
        fetch(
          `/api/maven/article?slug=${encodeURIComponent(msg.slug)}&locale=${encodeURIComponent(locale)}`,
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.ok) setReaderData(data);
          })
          .catch(() => {})
          .finally(() => setReaderLoading(false));
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [locale]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (readerOpen) setReaderOpen(false);
        else if (fullscreen) setFullscreen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readerOpen, fullscreen]);

  function toggleConsoleTheme() {
    const next = mavenTheme === 'obsidian' ? 'paper' : 'obsidian';
    setMavenTheme(next);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'plain-maven:set-theme', theme: next },
      '*',
    );
  }

  return (
    <div className={`maven-workspace ${fullscreen ? 'is-fullscreen' : ''}`}>
      <div className="maven-subbar">
        <div className="maven-subbar-left">
          <span className="maven-diamond">◆</span>
          <span className="maven-subbar-kicker">
            {labels.kicker || 'GEOINT // ECHTZEIT-LAGEBILD'}
          </span>
          <span className="maven-subbar-sep">·</span>
          <span className="maven-subbar-credit">
            {locale === 'de' ? '3D Spatial Engine:' : '3D Engine:'}{' '}
            <a
              href="https://github.com/bilawalsidhu/gods-eye-view"
              target="_blank"
              rel="noopener noreferrer"
            >
              God&rsquo;s Eye View — Bilawal Sidhu
            </a>{' '}
            (MIT)
          </span>
        </div>

        <div className="maven-subbar-actions">
          <button
            type="button"
            className="maven-bar-btn"
            onClick={toggleConsoleTheme}
          >
            {mavenTheme === 'obsidian' ? 'PLAIN. PAPER' : 'MAVEN OBSIDIAN'}
          </button>
          <button
            type="button"
            className="maven-bar-btn"
            onClick={() => setFullscreen((f) => !f)}
          >
            {fullscreen
              ? labels.exitFullscreen || 'Vollbild beenden'
              : labels.fullscreen || 'Vollbild'}
          </button>
          <a
            href={iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="maven-bar-btn"
          >
            ↗ {labels.standalone || 'Konsole'}
          </a>
        </div>
      </div>

      <div className="maven-stage">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={labels.title || 'PLAIN. Maven 3D Geospatial Intelligence'}
          className="maven-iframe"
          allow="fullscreen; clipboard-write"
        />

        {readerOpen && (
          <aside className="maven-reader-drawer" aria-label="PLAIN. Article Reader">
            <div className="maven-reader-head">
              <span className="maven-reader-kicker">
                ◆ PLAIN. {locale === 'de' ? 'VOLLTEXT-BERICHT' : 'FULL DISPATCH'}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {readerData?.path && (
                  <Link href={readerData.path} className="maven-bar-btn">
                    ↗ {locale === 'de' ? 'Artikelseite' : 'Article Page'}
                  </Link>
                )}
                <button
                  type="button"
                  className="maven-bar-btn"
                  onClick={() => setReaderOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="maven-reader-body">
              {readerLoading && (
                <p className="maven-reader-loading">
                  {locale === 'de'
                    ? 'Lade verifizierten Bericht…'
                    : 'Loading verified report…'}
                </p>
              )}

              {!readerLoading && readerData && (
                <>
                  {readerData.geo?.placeName && (
                    <div className="maven-reader-geo">
                      ◆ {readerData.geo.placeName}, {readerData.geo.country} ·{' '}
                      {readerData.geo.tacticalCoord}
                    </div>
                  )}
                  <h2 className="maven-reader-title">{readerData.title}</h2>
                  {readerData.dek && (
                    <p className="maven-reader-dek">{readerData.dek}</p>
                  )}

                  {readerData.facts?.length > 0 && (
                    <div className="maven-reader-facts">
                      <h3>{locale === 'de' ? 'Die Fakten' : 'Key Facts'}</h3>
                      <ul>
                        {readerData.facts.map((fact, idx) => (
                          <li key={idx}>{fact}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="maven-reader-paragraphs">
                    {(readerData.body || []).map((para, idx) =>
                      para.startsWith('## ') ? (
                        <h3 key={idx}>{para.slice(3)}</h3>
                      ) : (
                        <p key={idx}>{para}</p>
                      ),
                    )}
                  </div>

                  {readerData.context && (
                    <div className="maven-reader-context">
                      <h3>{locale === 'de' ? 'Hintergrund' : 'Context'}</h3>
                      <p>{readerData.context}</p>
                    </div>
                  )}

                  {readerData.sources?.length > 0 && (
                    <div className="maven-reader-sources">
                      <h3>{locale === 'de' ? 'Primärquellen' : 'Sources'}</h3>
                      <ul>
                        {readerData.sources.map((src, idx) => (
                          <li key={idx}>
                            <strong>{src.outlet}:</strong>{' '}
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                            >
                              {src.title || src.outlet} ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
