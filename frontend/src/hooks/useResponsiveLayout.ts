import { useState, useEffect } from 'react';

export type ViewportType = 'mobile' | 'tablet' | 'laptop' | 'desktop';
export type DockMode = 'mobile' | 'tablet' | 'desktop-compact' | 'desktop-expanded';
export type QueueCardMode = 'mobile' | 'tablet' | 'small-laptop' | 'compact' | 'desktop';
export type NavbarMode = 'expanded' | 'collapsed';
export type Orientation = 'portrait' | 'landscape';

export function useResponsiveLayout() {
  const [width, setWidth] = useState(() => window.innerWidth);
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const touchDevice = 
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const orientation: Orientation = height > width ? 'portrait' : 'landscape';

  // Base Viewport calculations
  let viewport: ViewportType = 'desktop';
  if (width < 480) {
    viewport = 'mobile';
  } else if (width < 768) {
    viewport = 'tablet';
  } else if (width < 1200) {
    viewport = 'laptop';
  } else {
    viewport = 'desktop';
  }

  // Navbar layout mode
  const navbarMode: NavbarMode = width < 1024 ? 'collapsed' : 'expanded';

  // Queue Card layout mode (5 Modes)
  let queueCardMode: QueueCardMode = 'desktop';
  if (width < 480) {
    queueCardMode = 'mobile';
  } else if (width < 768) {
    queueCardMode = 'tablet';
  } else if (width < 900) {
    queueCardMode = 'small-laptop';
  } else if (width < 1200) {
    queueCardMode = 'compact';
  } else {
    queueCardMode = 'desktop';
  }

  // Dock layout mode
  let dockMode: DockMode = 'desktop-expanded';
  if (width < 640) {
    dockMode = 'mobile';
  } else if (width < 768) {
    dockMode = 'tablet';
  } else if (width < 1024) {
    dockMode = 'desktop-compact';
  } else {
    dockMode = 'desktop-expanded';
  }

  const compactMode = height < 600 || width < 360;

  // Retrieve safe areas ( Notch / Dynamic Island / Navigation Bars )
  const [safeArea, setSafeArea] = useState({ top: 16, bottom: 16, left: 16, right: 16 });

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const getVal = (prop: string, fallback: number) => {
      const val = style.getPropertyValue(prop).trim();
      if (!val) return fallback;
      const num = parseInt(val, 10);
      return isNaN(num) ? fallback : num;
    };

    setSafeArea({
      top: Math.max(16, getVal('--safe-area-inset-top', 16)),
      bottom: Math.max(16, getVal('--safe-area-inset-bottom', 16)),
      left: Math.max(16, getVal('--safe-area-inset-left', 16)),
      right: Math.max(16, getVal('--safe-area-inset-right', 16)),
    });
  }, [width, height]);

  return {
    width,
    height,
    viewport,
    safeArea,
    orientation,
    layoutMode: viewport, // maps to viewport
    dockMode,
    queueCardMode,
    navbarMode,
    compactMode,
    touchDevice,
    isMobile: width < 768,
  };
}
