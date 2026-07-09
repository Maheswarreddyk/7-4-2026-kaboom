import { formatDuration } from '../utils/index.js';
import { ConnectionStatusBadge } from './ConnectionStatusBadge.js';
import { playTapSound } from '../utils/audio.js';
import { cn } from '../utils/index.js';
import logoKaboom from '../../images/logo_kaboom.png';
import iconKaboom from '../../images/icon_kaboom.png';

interface MobileHeaderProps {
  elapsedSeconds: number;
  connectionStatus: any;
  connectionQuality: 'excellent' | 'good' | 'poor' | null;
  isConnected: boolean;
  onLeave: () => void;
}

export function MobileHeader({
  elapsedSeconds,
  connectionStatus,
  connectionQuality,
  isConnected,
  onLeave,
}: MobileHeaderProps) {
  
  const handleLeavePress = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    playTapSound();
    
    try {
      if (navigator.vibrate) navigator.vibrate(12);
    } catch {}

    onLeave();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-30 select-none flex flex-col pointer-events-none">
      
      {/* ── Main Header Bar (72px) ── */}
      <div 
        className="w-full h-[72px] px-4 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/50 to-transparent pointer-events-auto"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-[12px] select-none pointer-events-auto">
          <img 
            src={iconKaboom} 
            alt="Kaboom TV Icon" 
            className="w-8 h-8 object-contain rounded-lg" 
          />
          <img 
            src={logoKaboom} 
            alt="Kaboom TV Logo" 
            className="h-[36px] w-auto object-contain" 
          />
        </div>

        {/* Center: Live Timer */}
        {isConnected && (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/5 text-xs font-mono font-bold tracking-wider text-white/90 shadow-md">
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              connectionQuality === 'excellent' ? "bg-emerald-500 animate-pulse" :
              connectionQuality === 'good' ? "bg-amber-500 animate-pulse" : "bg-red-500 animate-ping"
            )} />
            {formatDuration(elapsedSeconds)}
          </div>
        )}

        {/* Right: Close/Leave Button */}
        <button
          onPointerDown={handleLeavePress}
          className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all duration-300"
          aria-label="Leave chat room"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Status Badges Sub-Bar (Directly below header) ── */}
      {!isConnected && (
        <div className="px-4 py-1.5 flex items-center gap-2 pointer-events-auto">
          <ConnectionStatusBadge status={connectionStatus} />
        </div>
      )}
    </div>
  );
}
