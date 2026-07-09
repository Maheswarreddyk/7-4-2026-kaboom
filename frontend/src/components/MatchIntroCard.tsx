import { useEffect, useState, useRef } from 'react';
import { cn } from '../utils/index.js';

interface MatchIntroCardProps {
  partnerProfile: {
    displayName: string;
    bio?: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    matchAttributes?: {
      university?: string[];
      education_tags?: string[];
      city?: string[];
      country?: string[];
    };
    languages?: string[];
    interestTags?: string[];
  } | null;
  matchReasonMetadata?: {
    reason: 'strict_filters' | 'prefer_filters' | 'random';
    confidence: number;
    matchedBy: string[];
  } | null;
  status: string; // chatState.status
  isChatOpen: boolean;
  onDismiss: () => void;
}

export function MatchIntroCard({
  partnerProfile,
  matchReasonMetadata,
  status,
  isChatOpen,
  onDismiss
}: MatchIntroCardProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const hasDismissedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const triggerDismiss = (reason: string) => {
    if (hasDismissedRef.current) return;
    hasDismissedRef.current = true;
    console.log(`[PartnerIntro] Dismissed via: ${reason}`);

    setIsFadingOut(true);
    
    // Unmount overlay after transition duration
    setTimeout(() => {
      onDismissRef.current();
    }, 450);
  };

  // 1. Auto dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerDismiss('timeout');
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // 2. Chat drawer opened or connection state interrupted check
  useEffect(() => {
    if (isChatOpen) {
      triggerDismiss('drawer_open');
    }
  }, [isChatOpen]);

  useEffect(() => {
    const activeStates = ['CONNECTED', 'SIGNALING', 'MATCHED', 'NEGOTIATING', 'READY', 'ICE_CONNECTING', 'MEDIA_READY', 'REQUESTING_MEDIA'];
    if (!activeStates.includes(status) || !partnerProfile) {
      triggerDismiss('disconnected');
    }
  }, [status, partnerProfile]);

  // Pointer drag/swipe gestures
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const deltaY = e.clientY - dragStartY.current;
    if (deltaY < 0) {
      setDragOffset(deltaY); // Only allow dragging up
      if (deltaY < -50) {
        triggerDismiss('swipe');
      }
    }
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    if (dragOffset >= -50) {
      setDragOffset(0); // Snap back to center
    }
  };

  if (!partnerProfile) return null;

  const university = partnerProfile.matchAttributes?.university?.[0] || (partnerProfile as any).university || '';
  const city = partnerProfile.city || partnerProfile.matchAttributes?.city?.[0] || '';
  const country = partnerProfile.country || partnerProfile.matchAttributes?.country?.[0] || '';
  const locationStr = [city, country].filter(Boolean).join(', ');

  const matchedBy = matchReasonMetadata?.matchedBy || [];

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        transform: `translate(-50%, ${dragOffset}px)`,
        transition: isDragging.current ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease',
        zIndex: 9999,
      }}
      className={cn(
        "fixed top-6 left-1/2 w-[calc(100%-2rem)] max-w-[400px] bg-stone-900/85 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-4 overflow-hidden select-none cursor-grab active:cursor-grabbing text-left",
        isFadingOut ? "opacity-0 -translate-y-12 scale-95" : "animate-notification-in"
      )}
    >
      {/* Upper row: Sparkle, title, close */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg shrink-0">
          ✨
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase font-black tracking-widest text-amber-500">
            Match Established
          </p>
          <h4 className="text-sm font-extrabold text-stone-100 truncate">
            {partnerProfile.displayName || 'Guest'}
          </h4>
        </div>
        <button 
          onClick={() => triggerDismiss('close_click')}
          className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Match Criteria */}
      <div className="mt-3 space-y-2">
        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">
          Common interests
        </p>
        <div className="flex flex-wrap gap-1.5">
          {matchedBy.length > 0 ? (
            matchedBy.map((reason, idx) => (
              <span
                key={idx}
                className="text-[10px] font-extrabold px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg shadow-sm"
              >
                {reason}
              </span>
            ))
          ) : (
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-stone-800 border border-white/5 text-stone-300 rounded-lg">
              🎯 Mutual Match
            </span>
          )}
          {university && (
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-stone-800/80 border border-white/5 text-stone-300 rounded-lg flex items-center gap-1 shadow-sm">
              🎓 {university}
            </span>
          )}
          {locationStr && (
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-stone-800/80 border border-white/5 text-stone-300 rounded-lg flex items-center gap-1 shadow-sm">
              📍 {locationStr}
            </span>
          )}
        </div>
      </div>

      {/* Swipe handle indicator */}
      <div className="w-8 h-1 bg-white/10 rounded-full mx-auto mt-4 mb-0.5 opacity-60" />

      {/* Progress timeline bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5">
        <div className="progress-bar-shrink h-full bg-amber-500" />
      </div>
    </div>
  );
}
