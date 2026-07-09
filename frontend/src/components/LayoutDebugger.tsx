import { useState, useEffect } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';

export function LayoutDebugger() {
  const [visible, setVisible] = useState(false);
  const layout = useResponsiveLayout();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with Ctrl+Alt+D
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-4 p-4 rounded-xl bg-black/90 border border-red-500/30 text-[11px] font-mono text-green-400 z-[9999] pointer-events-none select-none max-w-[280px] space-y-1 shadow-2xl backdrop-blur-md">
      <div className="text-stone-100 font-bold border-b border-white/10 pb-1 mb-1 flex items-center justify-between">
        <span>📐 LAYOUT DEBUGGER</span>
        <span className="text-[9px] text-green-500 bg-green-500/10 px-1 rounded animate-pulse">ACTIVE</span>
      </div>
      <div><strong>Viewport:</strong> {layout.viewport}</div>
      <div><strong>Size:</strong> {layout.width}px × {layout.height}px</div>
      <div><strong>Orientation:</strong> {layout.orientation}</div>
      <div><strong>Queue Mode:</strong> {layout.queueCardMode}</div>
      <div><strong>Dock Mode:</strong> {layout.dockMode}</div>
      <div><strong>Navbar:</strong> {layout.navbarMode}</div>
      <div><strong>Compact:</strong> {layout.compactMode ? 'Yes' : 'No'}</div>
      <div><strong>Touch Device:</strong> {layout.touchDevice ? 'Yes' : 'No'}</div>
      <div><strong>Safe Insets:</strong> T:{layout.safeArea.top} B:{layout.safeArea.bottom} L:{layout.safeArea.left} R:{layout.safeArea.right}</div>
      <div className="border-t border-white/5 pt-1 mt-1 text-[9px] text-stone-400">
        Press <kbd className="bg-white/10 px-1 rounded text-white">Ctrl+Alt+D</kbd> to toggle.
      </div>
    </div>
  );
}
