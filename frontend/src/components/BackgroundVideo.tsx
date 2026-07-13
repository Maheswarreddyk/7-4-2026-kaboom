import { useEffect, useRef, useState } from 'react';
import desktopVideo from '../../images/kaboom_desktop.mp4';
import mobileVideo from '../../images/kaboom_mobile.mp4';

export function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRenderVideo, setShouldRenderVideo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isFading, setIsFading] = useState(false);

  // 1. Lazy Initialisation, Reduced Motion Check, and Viewport Selection
  useEffect(() => {
    // Check if user prefers reduced motion (accessibility constraint)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      console.log('[BackgroundVideo] Reduced motion active — skipping video load');
      return;
    }

    // Determine viewport size on mount
    const checkViewport = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport, { passive: true });

    // Delay initialization to protect Largest Contentful Paint (LCP)
    const timer = setTimeout(() => {
      setShouldRenderVideo(true);
    }, 100);

    return () => {
      window.removeEventListener('resize', checkViewport);
      clearTimeout(timer);
    };
  }, []);

  // 2. Playback State Management (Tab Visibility & Intersection Observer)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Pause when page is hidden, resume when visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Pause when video leaves the viewport (Intersection Observer)
    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(video);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (observer && video) {
        observer.unobserve(video);
      }
    };
  }, [shouldRenderVideo]);

  // 3. Smooth Fade-in Handler on CanPlay
  const handleCanPlay = () => {
    setIsFading(true);
    setIsVideoReady(true);
    
    // Remove will-change after transition completes (500ms)
    const timer = setTimeout(() => {
      setIsFading(false);
    }, 550);

    return () => clearTimeout(timer);
  };

  return (
    <div ref={containerRef} className="cinematic-bg-container">
      {shouldRenderVideo && (
        <video
          ref={videoRef}
          key={isMobile ? 'mobile' : 'desktop'}
          className={`cinematic-video ${isVideoReady ? 'cinematic-video--ready' : ''} ${
            isFading ? 'cinematic-video--fading' : ''
          }`}
          src={isMobile ? mobileVideo : desktopVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onCanPlay={handleCanPlay}
        />
      )}
      {/* Dark gradient overlay above video, below content */}
      <div className="cinematic-overlay" />
    </div>
  );
}
