import { cn } from '../utils/index.js';
import { playTapSound, playLikeSound } from '../utils/audio.js';

interface BottomToolbarProps {
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  disabled?: boolean;
}

export function BottomToolbar({
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  onLeave,
  disabled = false,
}: BottomToolbarProps) {
  
  const handlePress = (callback: () => void, isLike = false) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    if (isLike) {
      playLikeSound();
    } else {
      playTapSound();
    }

    try {
      if (isLike && navigator.vibrate) {
        navigator.vibrate([15, 10, 15]);
      } else if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}

    callback();
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 h-[88px] flex items-center justify-center gap-8 px-6 bg-gradient-to-t from-black/85 via-black/60 to-transparent pointer-events-auto select-none z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Mic Trigger */}
      <button
        onPointerDown={handlePress(onToggleMute)}
        className={cn(
          "w-14 h-14 min-w-[56px] min-h-[56px] rounded-full border flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90",
          isMuted 
            ? "bg-red-500/20 border-red-500/40 text-red-400" 
            : "bg-white/5 border-white/10 text-white hover:bg-white/10"
        )}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {isMuted ? (
          <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>



      {/* Camera Trigger */}
      <button
        onPointerDown={handlePress(onToggleCamera)}
        className={cn(
          "w-14 h-14 min-w-[56px] min-h-[56px] rounded-full border flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90",
          isCameraOff 
            ? "bg-red-500/20 border-red-500/40 text-red-400" 
            : "bg-white/5 border-white/10 text-white hover:bg-white/10"
        )}
        aria-label={isCameraOff ? "Enable camera" : "Disable camera"}
      >
        {isCameraOff ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
      {/* End Call Trigger */}
      <button
        onPointerDown={handlePress(onLeave)}
        className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full border bg-red-600 border-red-500 text-white flex items-center justify-center transition-all duration-300 hover:bg-red-500 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)] active:scale-90"
        aria-label="End Call"
        title="End Call"
      >
        <svg className="w-6 h-6 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      </button>
    </div>
  );
}
