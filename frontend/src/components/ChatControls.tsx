import { cn } from '../utils/index.js';

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
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 py-2 px-6 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl">
      {onOpenPreferences && (
        <button
          onClick={onOpenPreferences}
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg bg-white/5 border border-white/10 text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-90 hover:bg-white/15"
          title="Preferences"
        >
          ⚙️
        </button>
      )}

      <button
        onClick={onToggleMute}
        disabled={disabled}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90',
          isMuted 
            ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30' 
            : 'bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/15'
        )}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      <button
        onClick={onToggleCamera}
        disabled={disabled}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90',
          isCameraOff 
            ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30' 
            : 'bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/15'
        )}
        title={isCameraOff ? 'Enable Camera' : 'Disable Camera'}
      >
        {isCameraOff ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {onLike && (
        <button
          onClick={onLike}
          disabled={disabled}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-120 active:scale-90 shadow-lg", 
            liked 
              ? "bg-gradient-to-r from-red-500 to-pink-500 border border-red-400 text-white animate-heart-pop" 
              : "bg-white/5 border border-white/10 text-white/80 hover:text-red-400 hover:bg-white/15"
          )}
          title="Like Partner"
        >
          {liked ? '❤️' : '🤍'}
        </button>
      )}

      {onToggleChat && (
        <button
          onClick={onToggleChat}
          disabled={disabled}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center relative transition-all duration-200 hover:scale-110 active:scale-90',
            isChatOpen 
              ? 'bg-accent border border-accent/50 text-white' 
              : 'bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/15'
          )}
          title="Toggle Chat"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border border-black animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      <button
        onClick={onNext}
        disabled={disabled}
        className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-r from-accent to-purple-600 border border-accent/40 text-white shadow-lg transition-all duration-200 hover:scale-115 active:scale-85 hover:shadow-accent/40"
        title="Next"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>

      <button 
        onClick={onReport} 
        disabled={disabled} 
        className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-yellow-400 hover:bg-white/15 transition-all duration-200 hover:scale-110 active:scale-90" 
        title="Report"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </button>

      <button
        onClick={onToggleFullscreen}
        disabled={disabled}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90 hidden sm:flex',
          isFullscreen 
            ? 'bg-accent border border-accent/50 text-white' 
            : 'bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/15'
        )}
        title="Fullscreen"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      <button
        onClick={onLeave}
        className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500/20 border border-red-500/40 text-red-500 hover:bg-red-500/30 transition-all duration-200 hover:scale-110 active:scale-90"
        title="Leave Chat"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}
