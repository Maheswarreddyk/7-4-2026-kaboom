import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useResponsiveLayout, LayoutMode } from '../hooks/useResponsiveLayout.js';

export type ScreenPosition = 'TL' | 'TC' | 'TR' | 'BL' | 'BC' | 'BR';

export interface FloatingComponent {
  id: string;
  preferredPosition: ScreenPosition;
  width: number;
  height: number;
  isActive: boolean;
  zIndexKey: string;
  priority: number; // 1 = Never Hide, 2 = Medium, 3 = Decorative
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
}

interface FloatingLayoutContextType {
  registerComponent: (
    id: string,
    preferred: ScreenPosition,
    width: number,
    height: number,
    isActive: boolean,
    zIndexKey: string,
    priority?: number,
    minSize?: { w: number; h: number },
    maxSize?: { w: number; h: number }
  ) => void;
  unregisterComponent: (id: string) => void;
  setComponentActive: (id: string, isActive: boolean) => void;
  setComponentSize: (id: string, width: number, height: number) => void;
  getStyle: (id: string) => React.CSSProperties;
  isMobile: boolean;
  layoutMode: LayoutMode;
  safeInsets: { top: number; bottom: number; left: number; right: number };
  collisionCount: number;
}

const FloatingLayoutContext = createContext<FloatingLayoutContextType | null>(null);

// Central Z-Index System
export const Z_INDEX_SYSTEM: Record<string, number> = {
  bg: 0,
  videoRemote: 5,
  videoLocal: 10,
  statusBadges: 20,
  partnerCard: 30,
  rightDock: 40,
  bottomDock: 40,
  coachMark: 50,
  chatDrawer: 60,
  emojiPicker: 70,
  queueCard: 80,
  toast: 90,
  dialog: 100,
  alerts: 110,
};

export function FloatingLayoutProvider({ children }: { children: React.ReactNode }) {
  const { width, height, isMobile, layoutMode } = useResponsiveLayout();
  const [components, setComponents] = useState<Record<string, FloatingComponent>>({});
  const [collisionCount, setCollisionCount] = useState(0);

  // Parse Safe Area Insets ( Notch/Dynamic Island support )
  const [safeInsets, setSafeInsets] = useState({ top: 16, bottom: 16, left: 16, right: 16 });

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const getVal = (prop: string, fallback: number) => {
      const val = style.getPropertyValue(prop).trim();
      if (!val) return fallback;
      const num = parseInt(val, 10);
      return isNaN(num) ? fallback : num;
    };

    setSafeInsets({
      top: Math.max(16, getVal('--safe-area-inset-top', 16)),
      bottom: Math.max(16, getVal('--safe-area-inset-bottom', 16)),
      left: Math.max(16, getVal('--safe-area-inset-left', 16)),
      right: Math.max(16, getVal('--safe-area-inset-right', 16)),
    });
  }, [width, height]);

  const registerComponent = useCallback((
    id: string,
    preferred: ScreenPosition,
    w: number,
    h: number,
    isActive: boolean,
    zIndexKey: string,
    priority = 1,
    minSize?: { w: number; h: number },
    maxSize?: { w: number; h: number }
  ) => {
    setComponents((prev) => ({
      ...prev,
      [id]: { id, preferredPosition: preferred, width: w, height: h, isActive, zIndexKey, priority, minSize, maxSize },
    }));
  }, []);

  const unregisterComponent = useCallback((id: string) => {
    setComponents((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const setComponentActive = useCallback((id: string, isActive: boolean) => {
    setComponents((prev) => {
      if (!prev[id] || prev[id].isActive === isActive) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], isActive },
      };
    });
  }, []);

  const setComponentSize = useCallback((id: string, w: number, h: number) => {
    setComponents((prev) => {
      if (!prev[id] || (prev[id].width === w && prev[id].height === h)) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], width: w, height: h },
      };
    });
  }, []);

  // Compute collisions reactively
  useEffect(() => {
    let count = 0;
    const active = Object.values(components).filter(c => c.isActive);
    
    // Check overlapping bounding box collisions for active floating items
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (a.preferredPosition === b.preferredPosition) {
          count++;
        }
      }
    }
    setCollisionCount(count);
  }, [components]);

  // Central Dynamic Placement & Collision Resolver
  const getStyle = useCallback((id: string): React.CSSProperties => {
    const comp = components[id];
    if (!comp || !comp.isActive) return { display: 'none' };

    let pos = comp.preferredPosition;
    
    const isChatOpen = components['chat-drawer']?.isActive;
    const isPartnerCardVisible = components['partner-card']?.isActive;
    const isDockActive = components['controls-dock']?.isActive;
    const chatDrawerW = isMobile ? width : 360;

    // RULE 1: If Chat Drawer is open:
    // It occupies the entire right side of the screen (TR + BR slots).
    // Relocate any other TR/BR components to prevent overlapping.
    if (isChatOpen && id !== 'chat-drawer') {
      if (pos === 'TR') pos = isMobile ? 'TL' : 'TC';
      if (pos === 'BR') pos = isMobile ? 'BL' : 'BC';
    }

    // Set up safe positioning offsets
    // Header height changes dynamically with layoutMode
    let headerHeight = 72;
    if (layoutMode === 'Minimal') headerHeight = 56;
    else if (layoutMode === 'Compact') headerHeight = 60;
    else if (layoutMode === 'Medium') headerHeight = 64;

    const sTop = Math.max(headerHeight + 12, safeInsets.top);
    const sBottom = safeInsets.bottom;
    const sLeft = safeInsets.left;
    const sRight = safeInsets.right;

    let style: React.CSSProperties = {
      position: 'absolute',
      zIndex: Z_INDEX_SYSTEM[comp.zIndexKey] || 10,
      transition: 'all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)',
    };

    // RULE 2: If both controls-dock ('controls-dock') and queue-card ('queue-card') are at BC:
    // Stack the queue-card directly ABOVE the controls-dock.
    let bottomDockOffset = sBottom;
    if (isDockActive && id === 'queue-card' && pos === 'BC') {
      const dockHeight = components['controls-dock']?.height || 80;
      bottomDockOffset += dockHeight + 12;
    }

    // RULE 3: Snapping corners for self-preview PiP:
    // If self-preview snaps to BL and partner-card is visible at BL:
    // Stack self-preview above partner-card.
    let blOffset = sBottom;
    if (isPartnerCardVisible) {
      const partnerCardHeight = components['partner-card']?.height || 140;
      blOffset += partnerCardHeight + 12;
    }

    // If controls-dock is active in Minimal/Compact mode:
    // The mobile bottom stack sits at BL, so stack self-preview above it.
    const isMobileMode = layoutMode === 'Minimal' || layoutMode === 'Compact';
    if (isMobileMode && isDockActive && id === 'self-preview' && pos === 'BL') {
      blOffset += 70; // stack above mobile buttons
    }

    // If self-preview snaps to BR in Minimal/Compact mode:
    // Reflow/snap it to TR to prevent covering the large Swipe Next/Leave stack.
    let brOffset = sBottom;
    if (isMobileMode && isDockActive && id === 'self-preview' && pos === 'BR') {
      pos = 'TR'; // Reflow
    }

    // Apply resolved position styles
    switch (pos) {
      case 'TL':
        style.top = `${sTop}px`;
        style.left = `${sLeft}px`;
        break;

      case 'TC':
        style.top = `${sTop}px`;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;

      case 'TR':
        style.top = `${sTop}px`;
        if (isChatOpen && id !== 'chat-drawer') {
          style.right = `${sRight + chatDrawerW + 12}px`;
        } else {
          style.right = `${sRight}px`;
        }
        break;

      case 'BL':
        style.bottom = id === 'self-preview' ? `${blOffset}px` : `${sBottom}px`;
        style.left = `${sLeft}px`;
        break;

      case 'BC':
        style.bottom = id === 'queue-card' ? `${bottomDockOffset}px` : `${sBottom}px`;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;

      case 'BR':
        style.bottom = `${brOffset}px`;
        if (isChatOpen && id !== 'chat-drawer') {
          style.right = `${sRight + chatDrawerW + 12}px`;
        } else {
          style.right = `${sRight}px`;
        }
        break;
    }

    return style;
  }, [components, isMobile, safeInsets, width, layoutMode]);

  return (
    <FloatingLayoutContext.Provider value={{
      registerComponent,
      unregisterComponent,
      setComponentActive,
      setComponentSize,
      getStyle,
      isMobile,
      layoutMode,
      safeInsets,
      collisionCount,
    }}>
      {children}
    </FloatingLayoutContext.Provider>
  );
}

export function useFloatingLayout() {
  const context = useContext(FloatingLayoutContext);
  if (!context) {
    throw new Error('useFloatingLayout must be used within a FloatingLayoutProvider');
  }
  return context;
}
