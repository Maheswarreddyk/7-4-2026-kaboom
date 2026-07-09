import { useState, useEffect } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';

/**
 * LayoutDebugger — Development HUD
 * Toggle: Ctrl+Alt+D
 * Shows: all responsive state, viewport size, safe areas, layout modes
 * Color codes: green = normal, yellow = compact mode, red = potential collision zones
 */
export function LayoutDebugger() {
  const [visible, setVisible] = useState(false);
  const layout = useResponsiveLayout();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!visible) return null;

  // Color-code modes for quick visual scanning
  const modeColor = (mode: string) => {
    if (mode.includes('mobile-xs') || mode.includes('mobile')) return 'text-yellow-400';
    if (mode.includes('tablet')) return 'text-blue-400';
    if (mode.includes('compact') || mode.includes('small')) return 'text-amber-400';
    return 'text-green-400';
  };

  // Heuristic collision check — warn when two z-layers may be fighting
  const collisionWarnings: string[] = [];
  if (layout.width < 420 && layout.height < 650) {
    collisionWarnings.push('⚠️ Very small viewport — QueueCard may be minimal');
  }
  if (layout.dockMode === 'mobile' && layout.height < 700) {
    collisionWarnings.push('⚠️ Short mobile viewport — dock buttons may overlap');
  }
  if (layout.compactMode) {
    collisionWarnings.push('⚠️ Compact mode active (height<600 or width<360)');
  }

  return (
    <div
      className="fixed bottom-28 left-4 rounded-xl bg-black/95 border border-emerald-500/30 text-[10px] font-mono z-[9999] pointer-events-none select-none shadow-2xl backdrop-blur-xl"
      style={{ minWidth: '220px', maxWidth: '300px' }}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/10">
        <span className="text-white font-bold text-[11px]">📐 Layout HUD</span>
        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded animate-pulse">ACTIVE</span>
      </div>

      <div className="px-3 py-2 space-y-1">
        {/* Viewport */}
        <div className="flex justify-between">
          <span className="text-stone-500">Viewport</span>
          <span className={modeColor(layout.viewport)}>{layout.viewport}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Size</span>
          <span className="text-stone-200">{layout.width}×{layout.height}px</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Orientation</span>
          <span className="text-stone-300">{layout.orientation}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Touch</span>
          <span className={layout.touchDevice ? 'text-yellow-400' : 'text-stone-400'}>{layout.touchDevice ? 'Yes' : 'No'}</span>
        </div>

        {/* Separator */}
        <div className="border-t border-white/5 my-1" />

        {/* Layout Modes */}
        <div className="flex justify-between">
          <span className="text-stone-500">Queue Card</span>
          <span className={modeColor(layout.queueCardMode)}>{layout.queueCardMode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Dock</span>
          <span className={modeColor(layout.dockMode)}>{layout.dockMode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Navbar</span>
          <span className={layout.navbarMode === 'collapsed' ? 'text-yellow-400' : 'text-green-400'}>{layout.navbarMode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Compact</span>
          <span className={layout.compactMode ? 'text-red-400' : 'text-stone-400'}>{layout.compactMode ? 'YES' : 'No'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">isMobile</span>
          <span className={layout.isMobile ? 'text-yellow-400' : 'text-stone-400'}>{layout.isMobile ? 'Yes' : 'No'}</span>
        </div>

        {/* Separator */}
        <div className="border-t border-white/5 my-1" />

        {/* Safe areas */}
        <div className="text-stone-500 text-[9px] uppercase tracking-wider">Safe Insets</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
          <div className="flex justify-between"><span className="text-stone-600">Top</span><span className="text-stone-300">{layout.safeArea.top}px</span></div>
          <div className="flex justify-between"><span className="text-stone-600">Bottom</span><span className="text-stone-300">{layout.safeArea.bottom}px</span></div>
          <div className="flex justify-between"><span className="text-stone-600">Left</span><span className="text-stone-300">{layout.safeArea.left}px</span></div>
          <div className="flex justify-between"><span className="text-stone-600">Right</span><span className="text-stone-300">{layout.safeArea.right}px</span></div>
        </div>

        {/* Collision warnings */}
        {collisionWarnings.length > 0 && (
          <>
            <div className="border-t border-red-500/20 my-1" />
            <div className="text-red-400 text-[9px] space-y-0.5">
              {collisionWarnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          </>
        )}

        {/* Breakpoint ruler */}
        <div className="border-t border-white/5 mt-1 pt-1">
          <div className="text-stone-600 text-[9px] mb-1">Breakpoints</div>
          <div className="flex gap-0.5">
            {[320, 420, 560, 720, 900, 1100, 1400].map((bp) => (
              <div
                key={bp}
                className={`flex-1 h-1 rounded-full ${layout.width >= bp ? 'bg-emerald-500' : 'bg-stone-700'}`}
                title={`${bp}px`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-stone-600 mt-0.5">
            <span>320</span><span>560</span><span>900</span><span>1400</span>
          </div>
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-white/5 text-[9px] text-stone-600">
        Toggle: <kbd className="bg-white/10 px-1 rounded text-stone-400">Ctrl+Alt+D</kbd>
      </div>
    </div>
  );
}
