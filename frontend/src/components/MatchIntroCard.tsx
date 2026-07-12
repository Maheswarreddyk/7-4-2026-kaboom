import { useEffect, useState, useRef } from 'react';
import { cn, safeLocalStorage } from '../utils/index.js';

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
      languages?: string[];
      interests?: string[];
    };
    languages?: string[];
    interestTags?: string[];
  } | null;
  matchReasonMetadata?: {
    reason: 'strict_filters' | 'prefer_filters' | 'random';
    confidence: number;
    matchedBy: string[];
    matchedByDetails?: {
      university?: string;
      city?: string;
      languages?: string[];
      interests?: string[];
      state?: string;
      country?: string;
    };
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

  // Auto-dismiss after 4s (per V7 specifications)
  useEffect(() => {
    const t = setTimeout(() => triggerDismiss(), 4000);
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

  // Determine matching reasons dynamically
  const partnerUni = partnerProfile.matchAttributes?.university?.[0] || (partnerProfile as any).university || '';
  const partnerLangs = partnerProfile.languages || partnerProfile.matchAttributes?.languages || [];
  const partnerInterests = partnerProfile.interestTags || partnerProfile.matchAttributes?.interests || [];

  const localUni = safeLocalStorage.getItem('kaboom_university') || '';
  const localLangs = safeLocalStorage.getJSON<string[]>('kaboom_languages', []);
  const localInterests = safeLocalStorage.getJSON<string[]>('kaboom_interest_tags', []);

  const reasons: string[] = [];
  const details = matchReasonMetadata?.matchedByDetails;

  if (details) {
    // Priority 1: University
    if (details.university) {
      reasons.push(`🏫 ${details.university}`);
    }
    // Priority 2: City
    if (details.city) {
      reasons.push(`📍 ${details.city}`);
    }
    // Priority 3: Language
    if (details.languages && Array.isArray(details.languages)) {
      details.languages.forEach((lang: string) => {
        reasons.push(`💬 ${lang}`);
      });
    }
    // Priority 4: Interest
    if (details.interests && Array.isArray(details.interests)) {
      details.interests.forEach((interest: string) => {
        reasons.push(`🎮 ${interest}`);
      });
    }
    // Priority 5: State
    if (details.state) {
      reasons.push(`📍 ${details.state}`);
    }
    // Priority 6: Country
    if (details.country) {
      reasons.push(`🌎 ${details.country}`);
    }
  }

  // Fallback to local dynamic check if details are empty or not present
  if (reasons.length === 0) {
    // Priority 1: University comparison
    if (localUni && partnerUni && localUni.toLowerCase().trim() === partnerUni.toLowerCase().trim()) {
      reasons.push(`🏫 ${partnerUni}`);
    }
    // Priority 2: City comparison
    const localCity = safeLocalStorage.getItem('kaboom_city') || '';
    const partnerCity = partnerProfile.matchAttributes?.city?.[0] || (partnerProfile as any).city || '';
    if (localCity && partnerCity && localCity.toLowerCase().trim() === partnerCity.toLowerCase().trim()) {
      reasons.push(`📍 ${partnerCity}`);
    }
    // Priority 3: Language comparison
    const matchedLang = localLangs.find(l => partnerLangs.some(pl => pl.toLowerCase().trim() === l.toLowerCase().trim()));
    if (matchedLang) {
      reasons.push(`💬 ${matchedLang}`);
    }
    // Priority 4: Interest comparison
    const matchedInterest = localInterests.find(i => partnerInterests.some(pi => pi.toLowerCase().trim() === i.toLowerCase().trim()));
    if (matchedInterest) {
      reasons.push(`🎮 ${matchedInterest}`);
    }
    // Priority 5: State comparison
    const localState = safeLocalStorage.getItem('kaboom_state') || '';
    const partnerState = (partnerProfile.matchAttributes as any)?.state?.[0] || partnerProfile.state || '';
    if (localState && partnerState && localState.toLowerCase().trim() === partnerState.toLowerCase().trim()) {
      reasons.push(`📍 ${partnerState}`);
    }
    // Priority 6: Country comparison
    const localCountry = safeLocalStorage.getItem('kaboom_country') || '';
    const partnerCountry = (partnerProfile.matchAttributes as any)?.country?.[0] || partnerProfile.country || '';
    if (localCountry && partnerCountry && localCountry.toLowerCase().trim() === partnerCountry.toLowerCase().trim()) {
      reasons.push(`🌎 ${partnerCountry}`);
    }
  }

  // Fallback to compatibility text if no filters overlap
  if (reasons.length === 0) {
    reasons.push('⚡ Smart Match');
  }

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
        'rounded-[20px] overflow-hidden',
        'border border-white/[0.08]',
        'shadow-[0_0_32px_rgba(0,0,0,0.6),0_0_12px_rgba(251,191,36,0.10)]',
        isFadingOut
          ? 'opacity-0 -translate-y-6 scale-95 pointer-events-none'
          : 'animate-island-in'
      )}
    >
      <div className="absolute inset-0 bg-[rgba(14,14,14,0.72)] backdrop-blur-[28px]" />
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

      <div className="relative px-4 py-3 flex items-center gap-3">
        <div className="shrink-0 w-9 h-9 rounded-[12px] bg-amber-500/[0.12] border border-amber-400/20 flex items-center justify-center text-base">
          ✨
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-amber-400/90 leading-none mb-1 uppercase tracking-wide">
            Great news! We found someone matching your vibe.
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold text-stone-400">
              Matched because:
            </span>
            {reasons.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/20 text-[9px] font-bold text-amber-300 whitespace-nowrap"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-[2px] w-full bg-white/[0.04]">
        {/* Custom island animation running down to zero over 4s */}
        <div 
          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 transition-all ease-linear"
          style={{
            animation: 'progressShrink 4s linear forwards'
          }}
        />
      </div>

      {/* Progress bar shrink inline animation */}
      <style>{`
        @keyframes progressShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
