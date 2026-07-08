import React from 'react';
import { cn } from '../utils/index.js';
import { playTapSound, playLikeSound, playSwipeSound } from '../utils/audio.js';

interface ChatControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onNext: () => void;
  onReport: () => void;
  onLeave: () => void;
  onToggleFullscreen: () => void;
  disabled?: boolean;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  liked?: boolean;
  onLike?: () => void;
  onOpenPreferences?: () => void;
  unreadCount?: number;
}

export function ChatControls({
  isMuted,
  isCameraOff,
  isFullscreen,
  onToggleMute,
  onToggleCamera,
  onNext,
  onReport,
  onLeave,
  onToggleFullscreen,
  disabled = false,
  isChatOpen = false,
  liked = false,
  onLike,
  onOpenPreferences,
  unreadCount = 0,
  onToggleChat,
}: ChatControlsProps) {

  // Universal button trigger: play click audio feedback and call function
  const handlePress = (callback?: () => void, soundType?: 'tap' | 'like' | 'swipe') => (
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (disabled && callback !== onLeave) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Trigger specific sound effects
    if (soundType === 'like') {
      playLikeSound();
    } else if (soundType === 'swipe') {
      playSwipeSound();
    } else {
      playTapSound();
    }

    // Vibrate device if supported
    try {
      if (soundType === 'like' && navigator.vibrate) {
        navigator.vibrate([15, 10, 15]);
      } else if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}

    callback?.();
  };

  // SVGs for Premium Material Icons
  const Icons = {
    Settings: () => (
      <svg className="w-5 h-5 transition-transform duration-500 ease-out group-hover:rotate-[60deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    MicOn: () => (
      <svg className="w-5 h-5 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    MicOff: () => (
      <svg className="w-5 h-5 transition-all duration-300 animate-pulse text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      </svg>
    ),
    CameraOn: () => (
      <svg className="w-5 h-5 transition-transform duration-300 ease-out group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    CameraOff: () => (
      <svg className="w-5 h-5 transition-all duration-300 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
      </svg>
    ),
    LikeOn: () => (
      <svg className="w-5 h-5 text-red-500 fill-red-500 animate-heart-pop" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
    LikeOff: () => (
      <svg className="w-5 h-5 text-white/80 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    Chat: () => (
      <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-105" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    Next: () => (
      <svg className="w-6 h-6 text-white transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    ),
    Report: () => (
      <svg className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    Fullscreen: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    ),
    Leave: () => (
      <svg className="w-5 h-5 text-red-400 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  };

  const btnSpring = "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] active:scale-[0.92] group flex items-center justify-center rounded-full border shadow-lg relative";

  return (
    <>
      {/* ── DESKTOP VIEWPORT COMM DOCK (hidden on mobile) ── */}
      <div className="hidden sm:flex items-center justify-center gap-3 py-2 px-6 rounded-[22px] bg-black/45 backdrop-blur-2xl border border-white/5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] pointer-events-auto select-none">
        {onOpenPreferences && (
          <button
            onPointerDown={handlePress(onOpenPreferences)}
            className={cn(btnSpring, "w-12 h-12 bg-white/5 border-white/5 text-white/80 hover:bg-white/10 hover:border-white/10")}
            title="Preferences"
          >
            <Icons.Settings />
          </button>
        )}

        <button
          onPointerDown={handlePress(onToggleMute)}
          disabled={disabled}
          className={cn(
            btnSpring,
            "w-12 h-12",
            isMuted
              ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30"
              : "bg-white/5 border-white/5 text-white/80 hover:bg-white/10 hover:border-white/10"
          )}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <Icons.MicOff /> : <Icons.MicOn />}
        </button>

        <button
          onPointerDown={handlePress(onToggleCamera)}
          disabled={disabled}
          className={cn(
            btnSpring,
            "w-12 h-12",
            isCameraOff
              ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30"
              : "bg-white/5 border-white/5 text-white/80 hover:bg-white/10 hover:border-white/10"
          )}
          title={isCameraOff ? "Enable Camera" : "Disable Camera"}
        >
          {isCameraOff ? <Icons.CameraOff /> : <Icons.CameraOn />}
        </button>

        <div className="h-6 w-px bg-white/10 mx-1" />

        {onLike && (
          <button
            onPointerDown={handlePress(onLike, 'like')}
            disabled={disabled}
            className={cn(
              btnSpring,
              "w-12 h-12",
              liked
                ? "bg-gradient-to-r from-red-500 to-pink-500 border-red-400 text-white"
                : "bg-white/5 border-white/5 text-white/80 hover:border-white/10 hover:bg-white/10"
            )}
            title="Like Partner"
          >
            {liked ? <Icons.LikeOn /> : <Icons.LikeOff />}
          </button>
        )}

        {onToggleChat && (
          <button
            onPointerDown={handlePress(onToggleChat)}
            disabled={disabled}
            className={cn(
              btnSpring,
              "w-12 h-12",
              isChatOpen
                ? "bg-amber-500 border-amber-400 text-stone-950 shadow-[0_0_16px_0_rgba(245,166,37,0.35)]"
                : "bg-white/5 border-white/5 text-white/80 hover:border-white/10 hover:bg-white/10"
            )}
            title="Toggle Chat"
          >
            <Icons.Chat />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white border border-stone-950 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        )}

        <button
          onPointerDown={handlePress(onNext, 'swipe')}
          disabled={disabled}
          className={cn(btnSpring, "w-14 h-14 bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400/40 text-stone-950 hover:shadow-[0_8px_24px_rgba(245,166,35,0.35)]")}
          title="Next Partner"
        >
          <Icons.Next />
        </button>

        <button
          onPointerDown={handlePress(onReport)}
          disabled={disabled}
          className={cn(btnSpring, "w-12 h-12 bg-white/5 border-white/5 text-yellow-400/80 hover:bg-white/10 hover:border-white/10")}
          title="Report User"
        >
          <Icons.Report />
        </button>

        <button
          onPointerDown={handlePress(onToggleFullscreen)}
          disabled={disabled}
          className={cn(
            btnSpring,
            "w-12 h-12",
            isFullscreen
              ? "bg-amber-500 border-amber-400 text-stone-950"
              : "bg-white/5 border-white/5 text-white/80 hover:border-white/10 hover:bg-white/10"
          )}
          title="Toggle Fullscreen"
        >
          <Icons.Fullscreen />
        </button>

        <button
          onPointerDown={handlePress(onLeave)}
          className={cn(btnSpring, "w-12 h-12 bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-[0_4px_16px_rgba(239,68,68,0.2)]")}
          title="Leave Room"
        >
          <Icons.Leave />
        </button>
      </div>

      {/* ── MOBILE INSTAGRAM LIVE-STYLE CONTROLS DOCK ── */}
      <div className="sm:hidden fixed inset-0 pointer-events-none z-30 select-none">
        
        {/* Permanent Bottom Dock: Mic, Camera, Like (z-index 30) */}
        <div className="absolute bottom-[20px] left-[20px] flex items-center gap-3.5 pointer-events-auto">
          <button
            onPointerDown={handlePress(onToggleMute)}
            disabled={disabled}
            className={cn(
              btnSpring,
              "w-[50px] h-[50px] bg-black/45 backdrop-blur-xl border-white/5",
              isMuted ? "text-red-400" : "text-white"
            )}
          >
            {isMuted ? <Icons.MicOff /> : <Icons.MicOn />}
          </button>

          <button
            onPointerDown={handlePress(onToggleCamera)}
            disabled={disabled}
            className={cn(
              btnSpring,
              "w-[50px] h-[50px] bg-black/45 backdrop-blur-xl border-white/5",
              isCameraOff ? "text-red-400" : "text-white"
            )}
          >
            {isCameraOff ? <Icons.CameraOff /> : <Icons.CameraOn />}
          </button>

          {onLike && (
            <button
              onPointerDown={handlePress(onLike, 'like')}
              disabled={disabled}
              className={cn(
                btnSpring,
                "w-[50px] h-[50px] bg-black/45 backdrop-blur-xl border-white/5",
                liked ? "text-red-500 scale-110" : "text-white"
              )}
            >
              {liked ? <Icons.LikeOn /> : <Icons.LikeOff />}
            </button>
          )}
        </div>

        {/* Floating Right Stack: Next, Chat, Settings, Report (Large circular buttons) */}
        <div className="absolute bottom-[20px] right-[20px] flex flex-col items-center gap-3.5 pointer-events-auto">
          
          {/* Settings */}
          {onOpenPreferences && (
            <button
              onPointerDown={handlePress(onOpenPreferences)}
              className={cn(btnSpring, "w-[46px] h-[46px] bg-black/45 backdrop-blur-xl border-white/5 text-white/70")}
            >
              <Icons.Settings />
            </button>
          )}

          {/* Report */}
          <button
            onPointerDown={handlePress(onReport)}
            disabled={disabled}
            className={cn(btnSpring, "w-[46px] h-[46px] bg-black/45 backdrop-blur-xl border-white/5 text-yellow-400/80")}
          >
            <Icons.Report />
          </button>

          {/* Chat with badge */}
          {onToggleChat && (
            <button
              onPointerDown={handlePress(onToggleChat)}
              disabled={disabled}
              className={cn(
                btnSpring,
                "w-[48px] h-[48px] bg-black/45 backdrop-blur-xl border-white/5 text-white/80",
                isChatOpen && "bg-amber-500 text-stone-950 border-amber-400"
              )}
            >
              <Icons.Chat />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white border border-stone-950">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Next Button (Large 65px gradient) */}
          <button
            onPointerDown={handlePress(onNext, 'swipe')}
            disabled={disabled}
            className={cn(
              btnSpring,
              "w-[65px] h-[65px] bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400/40 text-stone-950 shadow-[0_8px_24px_rgba(245,166,35,0.35)]"
            )}
            title="Next"
          >
            <Icons.Next />
          </button>
          
          {/* Exit Room */}
          <button
            onPointerDown={handlePress(onLeave)}
            className={cn(btnSpring, "w-[46px] h-[46px] bg-red-500/10 border-red-500/20 text-red-500")}
            title="Leave"
          >
            <Icons.Leave />
          </button>
        </div>
      </div>
    </>
  );
}
