import { cn } from '../utils/index.js';
import { playTapSound, playSwipeSound } from '../utils/audio.js';

interface RightActionDockProps {
  onNext: () => void;
  onToggleChat: () => void;
  onOpenPreferences: () => void;
  onReport: () => void;
  unreadCount?: number;
  isChatOpen?: boolean;
  disabled?: boolean;
}

export function RightActionDock({
  onNext,
  onToggleChat,
  onOpenPreferences,
  onReport,
  unreadCount = 0,
  isChatOpen = false,
  disabled = false,
}: RightActionDockProps) {

  const handlePress = (callback: () => void, isSwipe = false) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (isSwipe) {
      playSwipeSound();
    } else {
      playTapSound();
    }

    try {
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}

    callback();
  };

  const btnSpring = "rounded-full border shadow-lg flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 relative pointer-events-auto bg-black/45 backdrop-blur-md border-white/10 text-white";

  return (
    <div 
      className="fixed right-[20px] bottom-[110px] flex flex-col items-center gap-[16px] pointer-events-none z-30 select-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 98px)' }}
    >
      {/* Settings Gear Toggle */}
      <button
        onPointerDown={handlePress(onOpenPreferences)}
        className={cn(btnSpring, "w-[56px] h-[56px] hover:bg-white/10")}
        aria-label="Open settings preferences"
      >
        <svg className="w-6 h-6 transition-transform duration-500 hover:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Report Button */}
      <button
        onPointerDown={handlePress(onReport)}
        className={cn(btnSpring, "w-[56px] h-[56px] text-yellow-400/80 hover:bg-white/10")}
        aria-label="Report partner"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </button>

      {/* Chat drawer Button */}
      <button
        onPointerDown={handlePress(onToggleChat)}
        className={cn(
          btnSpring,
          "w-[56px] h-[56px]",
          isChatOpen 
            ? "bg-amber-500 border-amber-400 text-stone-950 shadow-[0_0_16px_rgba(245,166,35,0.35)]" 
            : "hover:bg-white/10"
        )}
        aria-label="Toggle chat"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white border border-stone-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Next Skip Button (Largest: 72px) */}
      <button
        onPointerDown={handlePress(onNext, true)}
        className={cn(
          btnSpring,
          "w-[72px] h-[72px] bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400/40 text-stone-950 shadow-[0_8px_24px_rgba(245,166,35,0.35)] scale-100 hover:scale-105"
        )}
        aria-label="Skip to next partner"
      >
        <svg className="w-8 h-8 text-stone-950 transition-transform duration-300 hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
