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

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
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

  return (
    <figure className="clip-player-wrap">
      <div className="clip-player" onClick={togglePlay} onMouseEnter={() => setShowControls(true)}>
        <video
          ref={videoRef}
          src={src || video?.url}
          poster={poster}
          playsInline
          muted={isMuted}
          loop
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="clip-video"
        />

        {!isPlaying && (
          <button className="clip-play-btn" aria-label="Play video" onClick={togglePlay}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </button>
        )}

        <div className={`clip-overlay ${showControls ? 'visible' : ''}`}>
          <div className="clip-bar-track" onClick={handleSeek}>
            <div className="clip-bar-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="clip-btn-row">
            <span className="clip-tag">PLAIN. CLIP</span>
            <div className="clip-actions">
              <button className="clip-icon-btn" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
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

              <button className="clip-icon-btn" onClick={toggleFullscreen} aria-label="Fullscreen">
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
