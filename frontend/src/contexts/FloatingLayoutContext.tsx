import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';

export type ScreenPosition = 'TL' | 'TC' | 'TR' | 'BL' | 'BC' | 'BR';

export interface FloatingComponent {
  id: string;
  preferredPosition: ScreenPosition;
  width: number;
  height: number;
  isActive: boolean;
  zIndexKey: string;
}

interface FloatingLayoutContextType {
  registerComponent: (id: string, preferred: ScreenPosition, width: number, height: number, isActive: boolean, zIndexKey: string) => void;
  unregisterComponent: (id: string) => void;
  setComponentActive: (id: string, isActive: boolean) => void;
  setComponentSize: (id: string, width: number, height: number) => void;
  getStyle: (id: string) => React.CSSProperties;
  isMobile: boolean;
  viewportType: string;
  safeInsets: { top: number; bottom: number; left: number; right: number };
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
  const { width, height, isMobile, viewport } = useResponsiveLayout();
  const viewportType = viewport;
  const [components, setComponents] = useState<Record<string, FloatingComponent>>({});

  // Parse Safe Area Insets ( Notch/Dynamic Island support )
  const [safeInsets, setSafeInsets] = useState({ top: 16, bottom: 16, left: 16, right: 16 });

  useEffect(() => {
    // Dynamically retrieve safe areas if exposed via custom properties
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

  const registerComponent = useCallback((id: string, preferred: ScreenPosition, w: number, h: number, isActive: boolean, zIndexKey: string) => {
    setComponents((prev) => ({
      ...prev,
      [id]: { id, preferredPosition: preferred, width: w, height: h, isActive, zIndexKey },
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

  // Responsive Collision and Placement Solver
  const getStyle = useCallback((id: string): React.CSSProperties => {
    const comp = components[id];
    if (!comp || !comp.isActive) return { display: 'none' };

    let pos = comp.preferredPosition;
    const isChatOpen = components['chat-drawer']?.isActive;
    const isPartnerCardVisible = components['partner-card']?.isActive;

    // RULE 1: If Chat Drawer is open on Mobile, it occupies TR and BR slots completely.
    // Relocate any other TR/BR components to TL/BL fallbacks.
    if (isMobile && isChatOpen && id !== 'chat-drawer') {
      if (pos === 'TR') pos = 'TL';
      if (pos === 'BR') pos = 'BL';
    }

    // RULE 2: If self-preview is placed at BR on mobile, it collides with mobile right controls.
    // Relocate it to TR or BL.
    if (isMobile && id === 'self-preview' && pos === 'BR') {
      pos = 'TR'; // Default mobile fallback corner
    }

    // Set up safe positioning offsets
    const headerHeight = isMobile ? 64 : 72;
    const sTop = Math.max(headerHeight + 12, safeInsets.top);
    const sBottom = safeInsets.bottom;
    const sLeft = safeInsets.left;
    const sRight = safeInsets.right;

    let style: React.CSSProperties = {
      position: 'absolute',
      zIndex: Z_INDEX_SYSTEM[comp.zIndexKey] || 10,
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    };

    // Calculate final layout positions based on slots
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
        style.right = `${sRight}px`;
        break;

      case 'BL':
        style.bottom = `${sBottom}px`;
        style.left = `${sLeft}px`;
        
        // RULE 3: Stack self-preview above partner-card if both are BL during chat session
        if (id === 'self-preview' && isPartnerCardVisible) {
          const partnerCardHeight = components['partner-card']?.height || 140;
          style.bottom = `${sBottom + partnerCardHeight + 12}px`;
        }
        break;

      case 'BC':
        style.bottom = `${sBottom}px`;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;

      case 'BR':
        style.bottom = `${sBottom}px`;
        style.right = `${sRight}px`;
        break;
    }

    return style;
  }, [components, isMobile, safeInsets]);

  return (
    <FloatingLayoutContext.Provider value={{
      registerComponent,
      unregisterComponent,
      setComponentActive,
      setComponentSize,
      getStyle,
      isMobile,
      viewportType,
      safeInsets,
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
