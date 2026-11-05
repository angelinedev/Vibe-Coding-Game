import React, { useState, useEffect, useRef } from 'react';

interface LandingPageProps {
  onPlay: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onPlay }) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({
    position: 'absolute',
    left: '50%',
    top: '64%',
    transform: 'translate(-50%, -50%)',
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Cover-crop alignment math: matches video object-fit: cover across all screen sizes
  useEffect(() => {
    const updatePosition = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const videoAspect = 1920 / 1080;
      const screenAspect = vw / vh;

      let renderedWidth: number;
      let renderedHeight: number;
      let offsetX = 0;
      let offsetY = 0;

      if (screenAspect > videoAspect) {
        // Wider than 16:9: video fills width, cropped top/bottom
        renderedWidth = vw;
        renderedHeight = vw / videoAspect;
        offsetY = (vh - renderedHeight) / 2;
      } else {
        // Taller than 16:9: video fills height, cropped left/right
        renderedHeight = vh;
        renderedWidth = vh * videoAspect;
        offsetX = (vw - renderedWidth) / 2;
      }

      // Vertical spot: about 64% down the video, centered horizontally
      const playCircleX = offsetX + renderedWidth * 0.5;
      const playCircleY = offsetY + renderedHeight * 0.64;

      setPositionStyle({
        position: 'absolute',
        left: `${playCircleX}px`,
        top: `${playCircleY}px`,
        transform: 'translate(-50%, -50%)',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  // Keyboard navigation support: Enter or Space
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay();
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#05050a] overflow-hidden select-none font-mono flex items-center justify-center">
      <style>{`
        @keyframes breathingPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }
        .landing-play-btn {
          animation: breathingPulse 1.6s ease-in-out infinite;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: center center;
        }
        .landing-play-btn:hover {
          animation-play-state: paused;
          transform: scale(1.15);
        }
        .landing-play-btn:active {
          animation-play-state: paused;
          transform: scale(0.95);
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-play-btn {
            animation: none;
          }
        }
      `}</style>

      {/* Background Video */}
      {!videoError && (
        <video
          ref={videoRef}
          src="/landing.mp4"
          autoPlay
          muted
          playsInline
          loop
          onLoadedData={() => setVideoLoaded(true)}
          onError={() => setVideoError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 pointer-events-none ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Dark background fallback & loading indicator while video loads */}
      {!videoLoaded && !videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07070d] z-0">
          <div className="flex items-center gap-3 text-cyan-400 font-['Press_Start_2P'] text-xs">
            <span className="w-2.5 h-2.5 bg-cyan-400 animate-ping" />
            <span>Loading Arena...</span>
          </div>
        </div>
      )}

      {/* Graceful Fallback if video fails to load completely */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080811] z-0 p-6 text-center">
          <div className="relative border-4 border-cyan-500/40 bg-black/85 p-8 max-w-lg shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col items-center">
            <h1 className="font-['Press_Start_2P'] text-cyan-400 text-2xl md:text-3xl mb-4 tracking-wider leading-relaxed drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]">
              VIBE-CODIN'
            </h1>
            <p className="font-['VT323'] text-neutral-400 text-xl tracking-widest uppercase mb-8">
              AI Prompt Engineering Arena
            </p>

            <button
              onClick={onPlay}
              onKeyDown={handleKeyDown}
              aria-label="Start the game"
              className="landing-play-btn cursor-pointer bg-transparent border-0 p-0 m-0 outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-full"
              style={{
                width: 'clamp(64px, 12vmin, 120px)',
                height: 'clamp(64px, 12vmin, 120px)',
              }}
            >
              <img
                src="/playbutton.svg"
                alt=""
                className="w-full h-full object-contain pointer-events-none select-none block"
                draggable={false}
              />
            </button>

            <p className="mt-4 font-['Press_Start_2P'] text-[10px] text-amber-400 tracking-wider">
              PRESS START
            </p>
          </div>
        </div>
      )}

      {/* Subtle CRT Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(0,0,0,0)_1px,rgba(0,0,0,0.4)_1px)] [background-size:4px_4px] opacity-35 z-10" />

      {/* Play Button positioned over video with cover-crop alignment */}
      {!videoError && (
        <div style={positionStyle} className="z-20 pointer-events-none flex items-center justify-center">
          <button
            ref={buttonRef}
            id="landing-play-button"
            onClick={onPlay}
            onKeyDown={handleKeyDown}
            aria-label="Start the game"
            className="landing-play-btn pointer-events-auto cursor-pointer bg-transparent border-0 p-0 m-0 outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-full flex items-center justify-center select-none"
            style={{
              width: 'clamp(56px, 8.5vmin, 112px)',
              height: 'clamp(56px, 8.5vmin, 112px)',
            }}
          >
            <img
              src="/playbutton.svg"
              alt=""
              className="w-full h-full object-contain pointer-events-none select-none block"
              draggable={false}
            />
          </button>
        </div>
      )}
    </div>
  );
};
