import { useState, useEffect } from 'react';

export type LayoutMode = 'FULL' | 'COMPACT' | 'CONDENSED' | 'STACKED' | 'MINIMAL' | 'MOBILE';
export type Orientation = 'portrait' | 'landscape';

/**
 * useResponsiveLayout — Central Constraint-Based Responsive Layout Engine
 * 
 * Determines a single layoutMode for the entire application.
 * Removes breakpoint-driven components and replaces them with continuous
 * scaling governed by a single DOM class at the root level:
 * e.g., 'layout-mode-FULL', 'layout-mode-COMPACT', etc.
 */
export function useResponsiveLayout() {
  const [width, setWidth] = useState(() => window.innerWidth);
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    let rafId: number;
    const handleResize = () => {
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

  // Base layoutMode determined by viewport width
  let baseLayoutMode: LayoutMode = 'FULL';
  if (width < 560) {
    baseLayoutMode = 'MOBILE';
  } else if (width < 768) {
    baseLayoutMode = 'MINIMAL';
  } else if (width < 1024) {
    baseLayoutMode = 'STACKED';
  } else if (width < 1200) {
    baseLayoutMode = 'CONDENSED';
  } else if (width < 1440) {
    baseLayoutMode = 'COMPACT';
  } else {
    baseLayoutMode = 'FULL';
  }

  // compactMode (height constraints or extremely narrow screen)
  const compactMode = height < 600 || width < 360;

  // Degrade layoutMode if height is extremely constrained, ensuring components shrink
  let layoutMode = baseLayoutMode;
  if (height < 600) {
    if (baseLayoutMode === 'FULL') layoutMode = 'COMPACT';
    else if (baseLayoutMode === 'COMPACT') layoutMode = 'CONDENSED';
    else if (baseLayoutMode === 'CONDENSED') layoutMode = 'STACKED';
    else if (baseLayoutMode === 'STACKED') layoutMode = 'MINIMAL';
    else if (baseLayoutMode === 'MINIMAL' || baseLayoutMode === 'MOBILE') layoutMode = 'MOBILE';
  }

  // ── Sync to DOM root class for centralized CSS token overrides ──
  useEffect(() => {
    const root = document.documentElement;
    // Remove any previous layout-mode classes
    const classesToRemove = Array.from(root.classList).filter(c => c.startsWith('layout-mode-'));
    classesToRemove.forEach(c => root.classList.remove(c));
    // Add new layout-mode class
    root.classList.add(`layout-mode-${layoutMode}`);
  }, [layoutMode]);

  // Retrieve safe area insets (Notch / Dynamic Island / Nav Bars)
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

  // Backwards compatibility mappings for older components if any
  const isMobile = layoutMode === 'MOBILE' || layoutMode === 'MINIMAL';
  const queueCardMode = layoutMode === 'MOBILE' ? 'mobile' : 
                        layoutMode === 'MINIMAL' ? 'tablet' : 
                        layoutMode === 'STACKED' ? 'small-laptop' : 
                        layoutMode === 'CONDENSED' ? 'compact' : 'desktop';

  const dockMode = layoutMode === 'MOBILE' ? 'mobile' :
                   layoutMode === 'MINIMAL' ? 'tablet' :
                   layoutMode === 'STACKED' || layoutMode === 'CONDENSED' ? 'desktop-compact' : 'desktop-expanded';

  const navbarMode = layoutMode === 'MOBILE' || layoutMode === 'MINIMAL' || layoutMode === 'STACKED' ? 'collapsed' : 'expanded';

  return {
    width,
    height,
    safeArea,
    orientation,
    layoutMode,
    compactMode,
    touchDevice,
    isMobile,
    queueCardMode,
    dockMode,
    navbarMode,
  };
}
