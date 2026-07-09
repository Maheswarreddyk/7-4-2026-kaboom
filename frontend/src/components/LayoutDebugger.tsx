import { useState, useEffect } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { useFloatingLayout } from '../contexts/FloatingLayoutContext.js';

/**
 * LayoutDebugger — Toggle with Ctrl+Alt+D
 * Shows viewport metrics, unified layout mode, sub-modes, safe area,
 * active layout collisions, and horizontal scroll overflows.
 */
export function LayoutDebugger() {
  const [visible, setVisible] = useState(false);
  const layout = useResponsiveLayout();
  const { collisionCount } = useFloatingLayout();
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const checkOverflow = () => {
      setHasOverflow(document.documentElement.scrollWidth > window.innerWidth);
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [visible]);

  if (!visible) return null;

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'Comfortable': return 'text-green-400';
      case 'Medium': return 'text-blue-400';
      case 'Compact': return 'text-amber-400';
      case 'Minimal': return 'text-red-400 font-bold';
      default: return 'text-stone-300';
    }
  };

  return (
    <div
      className="fixed bottom-28 left-4 rounded-xl bg-black/95 border border-emerald-500/30 text-[10px] font-mono z-[9999] pointer-events-none select-none shadow-2xl backdrop-blur-xl"
      style={{ minWidth: '220px', maxWidth: '300px' }}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/10">
        <span className="text-white font-bold text-[11px]">📐 Responsive HUD</span>
        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded animate-pulse">ACTIVE</span>
      </div>

      <div className="px-3 py-2 space-y-1 text-stone-300">
        <div className="flex justify-between">
          <span className="text-stone-500">Viewport</span>
          <span>{layout.width} × {layout.height}px</span>
        </div>
        
        {/* Unified Layout Mode */}
        <div className="flex justify-between font-bold">
          <span className="text-stone-500">Layout Mode</span>
          <span className={getModeColor(layout.layoutMode)}>{layout.layoutMode}</span>
        </div>

        {/* Separator */}
        <div className="border-t border-white/5 my-1" />

        <div className="flex justify-between">
          <span className="text-stone-500">Queue Mode</span>
          <span className="text-stone-300">{layout.queueCardMode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Dock Mode</span>
          <span className="text-stone-300">{layout.dockMode}</span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-stone-500">Navbar Mode</span>
          <span className="text-stone-300">{layout.navbarMode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Compact Height</span>
          <span className={layout.compactMode ? 'text-amber-400 font-bold' : 'text-stone-500'}>
            {layout.compactMode ? 'Yes' : 'No'}
          </span>
        </div>

        {/* Separator */}
        <div className="border-t border-white/5 my-1" />

        {/* Floating Layout Collisions */}
        <div className="flex justify-between">
          <span className="text-stone-500">Collisions</span>
          <span className={collisionCount > 0 ? 'text-red-400 font-extrabold animate-pulse' : 'text-green-400'}>
            {collisionCount}
          </span>
        </div>

        {/* Safe Area Status */}
        <div className="flex justify-between">
          <span className="text-stone-500">Safe Areas</span>
          <span className="text-green-400">OK</span>
        </div>

        {/* Horizontal Scroll Overflow check */}
        <div className="flex justify-between">
          <span className="text-stone-500">Overflow</span>
          <span className={hasOverflow ? 'text-red-400 font-extrabold animate-bounce' : 'text-green-400'}>
            {hasOverflow ? 'YES (Horiz Scroll)' : 'No'}
          </span>
        </div>

        {/* Safe Area list */}
        <div className="border-t border-white/5 my-1 pt-1" />
        <div className="text-stone-500 text-[8px] uppercase tracking-wider mb-1">Safe Insets</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
          <div className="flex justify-between"><span className="text-stone-600">Top</span><span className="text-stone-300">{layout.safeArea.top}px</span></div>
          <div className="flex justify-between"><span className="text-stone-600">Bottom</span><span className="text-stone-300">{layout.safeArea.bottom}px</span></div>
          <div className="flex justify-between"><span className="text-stone-600">Left</span><span className="text-stone-300">{layout.safeArea.left}px</span></div>
          <div className="flex justify-between"><span className="text-stone-600">Right</span><span className="text-stone-300">{layout.safeArea.right}px</span></div>
        </div>

        {/* Breakpoint progress ruler */}
        <div className="border-t border-white/5 mt-2 pt-1.5">
          <div className="text-stone-600 text-[8px] mb-1">Active Breakpoint Bounds</div>
          <div className="flex gap-0.5">
            {[320, 560, 768, 1024, 1200, 1440].map((bp) => (
              <div
                key={bp}
                className={`flex-1 h-1 rounded-full ${layout.width >= bp ? 'bg-emerald-500' : 'bg-stone-700'}`}
                title={`Breakpoint threshold: ${bp}px`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-stone-600 mt-0.5">
            <span>320</span><span>768</span><span>1200</span><span>1440</span>
          </div>
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-white/5 text-[9px] text-stone-600">
        Toggle: <kbd className="bg-white/10 px-1 rounded text-stone-400">Ctrl+Alt+D</kbd>
      </div>
    </div>
  );
}
