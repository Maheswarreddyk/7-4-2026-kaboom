import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';

export type ScreenPosition = 'TL' | 'TC' | 'TR' | 'BL' | 'BC' | 'BR' | 'CC';

export interface FloatingComponent {
  id: string;
  preferredPosition: ScreenPosition;
  width: number;
  height: number;
  isActive: boolean;
  zIndexKey: string;
  priority: number; // 1 = High, 2 = Medium, 3 = Decorative
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
  const { width, height } = useResponsiveLayout();
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

    const activeComponents = Object.values(components).filter(c => c.isActive);
    const isChatOpen = components['chat-drawer']?.isActive;
    const chatDrawerW = width < 560 ? width : 360;

    // 1. Resolve slot target based on open regions (e.g. Chat Drawer pushes elements left)
    let pos = comp.preferredPosition;
    if (isChatOpen && id !== 'chat-drawer') {
      if (pos === 'TR') pos = width < 560 ? 'TL' : 'TC';
      if (pos === 'BR') pos = width < 560 ? 'BL' : 'BC';
    }

    // Special snap corners for self-preview on mobile
    if (id === 'self-preview' && width < 560) {
      if (pos === 'BR' || pos === 'BL') {
        pos = 'TR'; // Reflow up to avoid mobile keyboard / skip deck overlapping
      }
    }

    // 2. Set up layout margins
    const headerHeight = height < 500 ? 56 : height < 600 ? 60 : 64;
    const sTop = Math.max(headerHeight + 12, safeInsets.top);
    const sBottom = safeInsets.bottom;
    const sLeft = safeInsets.left;
    const sRight = safeInsets.right;

    // 3. Stacking calculation
    // Collect all components sitting at this resolved slot
    const slotElements = activeComponents.filter(c => {
      let resolvedPos = c.preferredPosition;
      if (isChatOpen && c.id !== 'chat-drawer') {
        if (resolvedPos === 'TR') resolvedPos = width < 560 ? 'TL' : 'TC';
        if (resolvedPos === 'BR') resolvedPos = width < 560 ? 'BL' : 'BC';
      }
      if (c.id === 'self-preview' && width < 560) {
        if (resolvedPos === 'BR' || resolvedPos === 'BL') {
          resolvedPos = 'TR';
        }
      }
      return resolvedPos === pos;
    });

    // Sort by priority (Priority 1 first), then alphabetically by id as a consistent tie-breaker
    slotElements.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.id.localeCompare(b.id);
    });

    // Calculate coordinate stacking offset
    let yOffset = pos.startsWith('T') ? sTop : sBottom;
    for (const item of slotElements) {
      if (item.id === id) {
        break;
      }
      yOffset += item.height + 12; // element height + spacing gap
    }

    // 4. Build return styles
    const style: React.CSSProperties = {
      position: 'absolute',
      zIndex: Z_INDEX_SYSTEM[comp.zIndexKey] || 10,
      transition: 'all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)',
      width: `${comp.width}px`,
    };

    const isSmallWidth = width < 560;

    switch (pos) {
      case 'CC': {
        const totalSlotHeight = slotElements.reduce((sum, item) => sum + item.height + 12, 0) - 12;
        const startY = height / 2 - totalSlotHeight / 2;
        let currentYOffset = 0;
        for (const item of slotElements) {
          if (item.id === id) {
            break;
          }
          currentYOffset += item.height + 12;
        }
        style.top = `${startY + currentYOffset}px`;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      }

      case 'TL':
        style.top = `${yOffset}px`;
        style.left = `${sLeft}px`;
        break;

      case 'TC':
        style.top = `${yOffset}px`;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;

      case 'TR':
        style.top = `${yOffset}px`;
        if (isChatOpen && id !== 'chat-drawer') {
          style.right = `${sRight + chatDrawerW + 12}px`;
        } else {
          style.right = `${sRight}px`;
        }
        break;

      case 'BL':
        style.bottom = `${yOffset}px`;
        style.left = `${sLeft}px`;
        break;

      case 'BC':
        style.bottom = `${yOffset}px`;
        if (isSmallWidth) {
          style.left = '0px';
          style.width = '100%';
          style.transform = 'none';
        } else {
          style.left = '50%';
          style.transform = 'translateX(-50%)';
        }
        break;

      case 'BR':
        style.bottom = `${yOffset}px`;
        if (isChatOpen && id !== 'chat-drawer') {
          style.right = `${sRight + chatDrawerW + 12}px`;
        } else {
          style.right = `${sRight}px`;
        }
        break;
    }

    return style;
  }, [components, safeInsets, width, height]);

  return (
    <FloatingLayoutContext.Provider value={{
      registerComponent,
      unregisterComponent,
      setComponentActive,
      setComponentSize,
      getStyle,
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
