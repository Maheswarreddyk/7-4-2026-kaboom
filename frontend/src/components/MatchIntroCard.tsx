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
  status: string;
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

  const triggerDismiss = () => {
    if (hasDismissedRef.current) return;
    hasDismissedRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => { onDismissRef.current(); }, 400);
  };

  // Auto-dismiss after 5s
  useEffect(() => {
    const t = setTimeout(() => triggerDismiss(), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isChatOpen) triggerDismiss();
  }, [isChatOpen]);

  useEffect(() => {
    const ok = ['CONNECTED', 'SIGNALING', 'MATCHED', 'NEGOTIATING', 'READY', 'ICE_CONNECTING', 'MEDIA_READY', 'REQUESTING_MEDIA'];
    if (!ok.includes(status) || !partnerProfile) triggerDismiss();
  }, [status, partnerProfile]);

  // Pointer drag (swipe up to dismiss)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const d = e.clientY - dragStartY.current;
    if (d < 0) {
      setDragOffset(d);
      if (d < -48) triggerDismiss();
    }
  };
  const handlePointerUp = () => {
    isDragging.current = false;
    if (dragOffset > -48) setDragOffset(0);
  };

  if (!partnerProfile) return null;

  // Collect all match attributes into a flat list (max 3 shown, overflow → +N)
  const matchedBy = matchReasonMetadata?.matchedBy ?? [];
  const university = partnerProfile.matchAttributes?.university?.[0] || (partnerProfile as any).university || '';
  const city = partnerProfile.city || partnerProfile.matchAttributes?.city?.[0] || '';
  const country = partnerProfile.country || partnerProfile.matchAttributes?.country?.[0] || '';
  const locationStr = [city, country].filter(Boolean).join(', ');

  const allAttrs: string[] = [
    ...matchedBy,
    ...(university ? [`🎓 ${university}`] : []),
    ...(locationStr ? [`📍 ${locationStr}`] : []),
  ];
  const MAX_ATTRS = 3;
  const visibleAttrs = allAttrs.slice(0, MAX_ATTRS);
  const overflowCount = allAttrs.length - MAX_ATTRS;

  const name = partnerProfile.displayName || 'Guest';

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        transform: `translate(-50%, ${dragOffset}px)`,
        transition: isDragging.current ? 'none' : 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
        zIndex: 9999,
        willChange: 'transform, opacity',
      }}
      className={cn(
        'fixed top-4 left-1/2 select-none cursor-grab active:cursor-grabbing',
        'w-[calc(100%-2rem)] max-w-[360px]',
        // Glass pill — Dynamic Island style
        'rounded-[20px] overflow-hidden',
        'border border-white/[0.08]',
        'shadow-[0_0_32px_rgba(0,0,0,0.6),0_0_12px_rgba(251,191,36,0.10)]',
        isFadingOut
          ? 'opacity-0 -translate-y-6 scale-95 pointer-events-none'
          : 'animate-island-in'
      )}
    >
      {/* Glass backdrop */}
      <div className="absolute inset-0 bg-[rgba(14,14,14,0.72)] backdrop-blur-[28px]" />

      {/* Ambient top glow strip */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

      {/* Content */}
      <div className="relative px-4 py-3 flex items-center gap-3">
        {/* Sparkle icon pill */}
        <div className="shrink-0 w-9 h-9 rounded-[12px] bg-amber-500/[0.12] border border-amber-400/20 flex items-center justify-center text-base">
          ✨
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-amber-400/80 leading-none mb-[3px]">
            Connected with
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white truncate leading-tight">
              {name}
            </span>
            {/* Visible match attrs */}
            {visibleAttrs.map((attr, i) => (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-[2px] rounded-full bg-amber-500/10 border border-amber-400/20 text-[9px] font-bold text-amber-300 whitespace-nowrap"
              >
                {attr}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-[2px] rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-stone-400">
                +{overflowCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2px progress bar */}
      <div className="relative h-[2px] w-full bg-white/[0.04]">
        <div className="island-progress-bar h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300" />
      </div>
    </div>
  );
}
