import { useEffect, useState } from 'react';
import { cn } from '../utils/index.js';

const TIPS = [
  "💬 Tap chat to send messages.",
  "❤️ Double tap to Like.",
  "👈 Swipe left to meet someone new.",
  "🎉 Long press for quick controls.",
  "🔥 React with emojis.",
  "⚙️ Drag your camera preview anywhere."
];

export function TipEngine() {
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if suggestions are enabled (default to 'ON')
    const checkEnabled = () => {
      return localStorage.getItem('kaboom_suggestions_enabled') !== 'OFF';
    };

    if (!checkEnabled()) return;

    let displayTimeout: ReturnType<typeof setTimeout>;
    
    // Pick first tip after 10 seconds
    const initialTimer = setTimeout(() => {
      triggerRandomTip();
    }, 10000);

    const interval = setInterval(() => {
      if (checkEnabled()) {
        triggerRandomTip();
      }
    }, 40000); // Trigger every 40 seconds

    function triggerRandomTip() {
      setActiveTip((prev) => {
        const remaining = TIPS.filter((t) => t !== prev);
        const nextTip = remaining[Math.floor(Math.random() * remaining.length)];
        
        setIsVisible(true);
        // Auto-hide after 6 seconds
        displayTimeout = setTimeout(() => {
          setIsVisible(false);
        }, 6000);

        return nextTip;
      });
    }

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(displayTimeout);
      clearInterval(interval);
    };
  }, []);

  if (!activeTip) return null;

  return (
    <div 
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white text-xs font-bold tracking-wide shadow-2xl flex items-center gap-2.5 z-[100] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] select-none pointer-events-none",
        isVisible 
          ? "translate-y-0 opacity-100 scale-100" 
          : "-translate-y-16 opacity-0 scale-90"
      )}
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 12px rgba(255, 255, 255, 0.05)'
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      <span>{activeTip}</span>
    </div>
  );
}
