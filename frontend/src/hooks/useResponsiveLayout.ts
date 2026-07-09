import { useState, useEffect } from 'react';

export type ViewportType = 'mobile-xs' | 'mobile' | 'tablet' | 'laptop' | 'desktop';
export type DockMode = 'mobile' | 'tablet' | 'desktop-compact' | 'desktop-expanded';
export type QueueCardMode = 'mobile-xs' | 'mobile' | 'tablet' | 'small-laptop' | 'compact' | 'desktop';
export type NavbarMode = 'expanded' | 'collapsed';
export type Orientation = 'portrait' | 'landscape';

/**
 * useResponsiveLayout — Central Responsive Engine
 * 
 * Single source of truth for ALL responsive decisions in the app.
 * Components should read layout modes from this hook rather than
 * using raw window.innerWidth checks or ad-hoc Tailwind breakpoints.
 * 
 * Layout Modes:
 * 
 * QueueCard (6 steps — smooth continuous progression):
 *   mobile-xs  (<420)  — minimal 1-line pill bar
 *   mobile     (<560)  — collapsed pill with expand arrow (bottom sheet)
 *   tablet     (<720)  — compact inline card
 *   small-laptop (<900) — 2-column grid card
 *   compact    (<1100) — full card, reduced padding
 *   desktop    (≥1100) — full card, standard padding
 *
 * Dock (4 steps):
 *   mobile          (<640)  — FaceTime fixed bottom/right split
 *   tablet          (<768)  — horizontal bar with overflow menu
 *   desktop-compact (<1024) — horizontal bar with overflow menu, larger
 *   desktop-expanded(≥1024) — full 9-button horizontal bar
 *
 * Navbar:
 *   collapsed (<1024) — logo + hamburger
 *   expanded  (≥1024) — logo + nav links + CTA
 */
export function useResponsiveLayout() {
  const [width, setWidth] = useState(() => window.innerWidth);
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    let rafId: number;
    const handleResize = () => {
      // Use rAF to batch resize events and avoid excessive re-renders
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setWidth(window.innerWidth);
        setHeight(window.innerHeight);
      });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const touchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const orientation: Orientation = height > width ? 'portrait' : 'landscape';

  // ── Base Viewport (for generic isMobile checks) ──
  let viewport: ViewportType = 'desktop';
  if (width < 420) {
    viewport = 'mobile-xs';
  } else if (width < 560) {
    viewport = 'mobile';
  } else if (width < 768) {
    viewport = 'tablet';
  } else if (width < 1100) {
    viewport = 'laptop';
  } else {
    viewport = 'desktop';
  }

  // ── Navbar mode ──
  const navbarMode: NavbarMode = width < 1024 ? 'collapsed' : 'expanded';

  // ── Queue Card layout mode (6 steps, smooth transitions) ──
  let queueCardMode: QueueCardMode = 'desktop';
  if (width < 420) {
    queueCardMode = 'mobile-xs';    // Minimal 1-line pill bar
  } else if (width < 560) {
    queueCardMode = 'mobile';       // Collapsed pill + bottom sheet expand
  } else if (width < 720) {
    queueCardMode = 'tablet';       // Compact inline card
  } else if (width < 900) {
    queueCardMode = 'small-laptop'; // 2-column grid card
  } else if (width < 1100) {
    queueCardMode = 'compact';      // Full card, reduced padding
  } else {
    queueCardMode = 'desktop';      // Full card, standard padding
  }

  // ── Dock layout mode (4 steps) ──
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

  // ── Safe Area Insets (Notch / Dynamic Island / Nav Bars) ──
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
    layoutMode: viewport,   // alias for backwards compat
    dockMode,
    queueCardMode,
    navbarMode,
    compactMode,
    touchDevice,
    isMobile: width < 768,  // consistent threshold used everywhere
  };
}
