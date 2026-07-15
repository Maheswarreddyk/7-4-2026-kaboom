import { useEffect, useRef, useState } from 'react';
import { cn } from '../utils/index.js';

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
  label?: string;
  placeholder?: string;
  fullscreen?: boolean;
  onAspectRatioChange?: (ratio: number) => void;
  frozen?: boolean;
}

export function VideoPlayer({
  stream,
  muted = false,
  mirrored = false,
  className,
  label,
  placeholder = 'Waiting for video...',
  fullscreen = false,
  onAspectRatioChange,
  onPlaying,
  frozen = false,
}: VideoPlayerProps & { onPlaying?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Keep latest aspect ratio callback ref to avoid resetting effects
  const onAspectRatioChangeRef = useRef(onAspectRatioChange);
  useEffect(() => {
    onAspectRatioChangeRef.current = onAspectRatioChange;
  }, [onAspectRatioChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (frozen) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [frozen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleResize = () => {
      if (video.videoWidth && video.videoHeight) {
        const ratio = video.videoWidth / video.videoHeight;
        onAspectRatioChangeRef.current?.(ratio);
      }
    };

    video.addEventListener('resize', handleResize);
    video.addEventListener('loadedmetadata', handleResize);

    // Run immediately to capture dimensions of already loaded streams
    if (video.videoWidth && video.videoHeight) {
      handleResize();
    }

    return () => {
      video.removeEventListener('resize', handleResize);
      video.removeEventListener('loadedmetadata', handleResize);
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      
      // Explicitly call play() to trigger stream presentation.
      // Register interaction fallbacks for autoplay policies on iOS/Safari.
      video.play().catch((error) => {
        console.warn('[VideoPlayer] Autoplay was prevented by browser security policy:', error);
        
        const forcePlay = () => {
          video.play().catch((err) => console.error('[VideoPlayer] Retry play failed:', err));
          document.removeEventListener('click', forcePlay);
          document.removeEventListener('touchstart', forcePlay);
        };
        
        document.addEventListener('click', forcePlay);
        document.addEventListener('touchstart', forcePlay);
      });
    } else {
      video.srcObject = null;
    }

    return () => {
      video.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    if (stream && !mirrored) { // Only do this for the remote stream
      setIsStarting(true);
      const timer = setTimeout(() => setIsStarting(false), 800);
      return () => clearTimeout(timer);
    }
  }, [stream, mirrored]);

  return (
    <div className={cn('relative overflow-hidden bg-black/50 w-full h-full flex items-center justify-center', className)}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={cn(
            'transition-all duration-700 w-full h-full',
            fullscreen ? 'object-cover' : 'object-contain',
            mirrored && 'scale-x-[-1]',
            frozen && 'blur-[4px] grayscale-[0.3] brightness-[0.8]',
            isStarting && 'blur-[12px] scale-105 brightness-110 grayscale-[0.5]'
          )}
          onPlaying={onPlaying}
          style={{
            // Hardware acceleration hints for high quality scaling without flickering
            willChange: 'transform',
            transform: mirrored ? 'scaleX(-1) translate3d(0,0,0)' : 'translate3d(0,0,0)',
            backfaceVisibility: 'hidden',
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm">{placeholder}</p>
          </div>
        </div>
      )}
      {label && (
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-black/50 text-xs text-white/70">
          {label}
        </div>
      )}
    </div>
  );
}
