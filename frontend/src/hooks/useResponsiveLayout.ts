import { useState, useEffect } from 'react';

export type LayoutMode = 'Comfortable' | 'Medium' | 'Compact' | 'Minimal';
export type Orientation = 'portrait' | 'landscape';

/**
 * useResponsiveLayout — Central Space-Based Layout Engine
 * 
 * Evaluates both width and height constraints.
 * 
 * Space States:
 *   - Comfortable (height >= 720px and width >= 1200px)
 *   - Medium (height >= 600px and width >= 768px)
 *   - Compact (height >= 500px and width >= 560px)
 *   - Minimal (height < 500px or width < 560px)
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

  // Compute LayoutMode based on available width AND height
  let layoutMode: LayoutMode = 'Comfortable';
  if (width < 560 || height < 500) {
    layoutMode = 'Minimal';
  } else if (width < 768 || height < 600) {
    layoutMode = 'Compact';
  } else if (width < 1200 || height < 720) {
    layoutMode = 'Medium';
  } else {
    layoutMode = 'Comfortable';
  }

  // Sync to root DOM class for layout-mode styling overrides
  useEffect(() => {
    const root = document.documentElement;
    const classesToRemove = Array.from(root.classList).filter(c => c.startsWith('layout-mode-'));
    classesToRemove.forEach(c => root.classList.remove(c));
    root.classList.add(`layout-mode-${layoutMode}`);
  }, [layoutMode]);

  // Safe area insets parsing
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

  // Backwards compatibility mappings
  const isMobile = layoutMode === 'Minimal' || layoutMode === 'Compact';
  const queueCardMode = layoutMode === 'Minimal' ? 'mobile' : 
                        layoutMode === 'Compact' ? 'tablet' : 
                        layoutMode === 'Medium' ? 'compact' : 'desktop';

  const dockMode = layoutMode === 'Minimal' ? 'mobile' :
                   layoutMode === 'Compact' ? 'tablet' :
                   layoutMode === 'Medium' ? 'desktop-compact' : 'desktop-expanded';

  const navbarMode = layoutMode === 'Minimal' || layoutMode === 'Compact' ? 'collapsed' : 'expanded';

  return {
    width,
    height,
    safeArea,
    orientation,
    layoutMode,
    compactMode: layoutMode === 'Minimal' || layoutMode === 'Compact',
    touchDevice,
    isMobile,
    queueCardMode,
    dockMode,
    navbarMode,
  };
}
