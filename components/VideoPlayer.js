'use client';

import { useState, useRef } from 'react';

export default function VideoPlayer({ video, src, poster, title, caption }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Check if it's a YouTube video
  const ytId = video?.id || (typeof src === 'string' && src.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)?.[1]);
  const isYouTube = video?.type === 'youtube' || Boolean(ytId) || (typeof src === 'string' && src.includes('youtube'));
  const embedUrl = video?.embedUrl || (ytId ? `https://www.youtube-nocookie.com/embed/${ytId}` : src);

  // If YouTube video, render direct responsive iframe for seamless one-click playback
  if (isYouTube) {
    return (
      <figure className="clip-player-wrap">
        <div className="clip-player">
          <iframe
            src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}rel=0&modestbranding=1`}
            title={title || 'PLAIN. Video Footage'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            className="clip-iframe"
          />
        </div>
        {caption && (
          <figcaption className="clip-caption">
            <strong>FOOTAGE</strong> · {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const togglePlay = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      setIsLoading(true);
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch((err) => {
            console.warn('Play attempt failed, trying muted fallback:', err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setIsLoading(false);
                })
                .catch((fallbackErr) => {
                  console.error('Video playback failed:', fallbackErr);
                  setIsLoading(false);
                  setHasError(true);
                });
            }
          });
      }
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      videoRef.current.requestFullscreen?.() || videoRef.current.parentElement?.requestFullscreen?.();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration || 1;
    setProgress((current / total) * 100);
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = pos * videoRef.current.duration;
    }
  };

  const videoUrl = src || video?.url;

  return (
    <figure className="clip-player-wrap">
      <div
        className="clip-player"
        onClick={togglePlay}
        onMouseEnter={() => setShowControls(true)}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          poster={poster}
          playsInline
          muted={isMuted}
          preload="metadata"
          referrerPolicy="no-referrer"
          loop
          onTimeUpdate={handleTimeUpdate}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsPlaying(true);
            setIsLoading(false);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={(e) => {
            console.error('HTML5 video error event:', e);
            setHasError(true);
            setIsLoading(false);
          }}
          className="clip-video"
        />

        {!isPlaying && !isLoading && (
          <button
            type="button"
            className="clip-play-btn"
            aria-label="Play video"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay(e);
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </button>
        )}

        {isLoading && (
          <div className="clip-loading-indicator">
            <div className="clip-spinner" />
          </div>
        )}

        {hasError && (
          <div className="clip-error-fallback" onClick={(e) => e.stopPropagation()}>
            <p>Clip kann im Browser nicht direkt gestreamt werden.</p>
            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="clip-external-link"
              >
                In neuem Tab öffnen ↗
              </a>
            )}
          </div>
        )}

        <div className={`clip-overlay ${showControls ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="clip-bar-track" onClick={handleSeek}>
            <div className="clip-bar-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="clip-btn-row">
            <span className="clip-tag">PLAIN. CLIP</span>
            <div className="clip-actions">
              <button
                type="button"
                className="clip-icon-btn"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="clip-icon-btn"
                onClick={toggleFullscreen}
                aria-label="Fullscreen"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
                  <path d="M8 3H3v5" />
                  <path d="M16 3h5v5" />
                  <path d="M8 21H3v-5" />
                  <path d="M16 21h5v-5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {caption && (
        <figcaption className="clip-caption">
          <strong>FOOTAGE</strong> · {caption}
        </figcaption>
      )}
    </figure>
  );
}
