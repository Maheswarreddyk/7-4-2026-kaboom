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

const CHECKLIST_ITEMS = [
  '✓ Match Found',
  '✓ Preferences Compared',
  '✓ Secure Channel Created',
  '✓ Camera Connected',
  '✓ Microphone Connected',
  '🟢 Ready!'
];

export function MatchIntroCard({
  partnerProfile,
  matchReasonMetadata,
  status,
  isChatOpen,
  onDismiss
}: MatchIntroCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [allowInteraction, setAllowInteraction] = useState(false);
  const [checklistIndex, setChecklistIndex] = useState(0);

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const hasDismissedRef = useRef(false);

  const triggerDismiss = (reason: 'normal' | 'force' | 'timeout' | 'interrupted') => {
    if (hasDismissedRef.current) return;
    hasDismissedRef.current = true;

    if (reason === 'timeout') {
      console.warn('[PartnerIntro] PartnerIntro Force Closed (Timeout)');
    } else if (reason === 'interrupted') {
      console.log('[PartnerIntro] PartnerIntro Interrupted');
    } else if (reason === 'force') {
      console.log('[PartnerIntro] PartnerIntro Force Closed');
    } else {
      console.log('[PartnerIntro] PartnerIntro Closed');
    }

    setIsFadingOut(true);
    setIsVisible(false);
    
    // Unmount overlay after transition duration
    setTimeout(() => {
      onDismissRef.current();
    }, 350);
  };

  // 1. Mount & Entrance Log
  useEffect(() => {
    console.log('[PartnerIntro] PartnerIntro Opened');
    const enterTimer = setTimeout(() => setIsVisible(true), 50);
    
    // Allow pointer events through after 2 seconds
    const interactionTimer = setTimeout(() => {
      setAllowInteraction(true);
    }, 2000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(interactionTimer);
    };
  }, []);

  // 2. Checklist Animation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setChecklistIndex((prev) => {
        if (prev < CHECKLIST_ITEMS.length - 1) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // 3. Status-based auto close (CONNECTED state for 3 seconds)
  useEffect(() => {
    if (status === 'CONNECTED') {
      const timer = setTimeout(() => {
        triggerDismiss('normal');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // 4. Safety Failsafe Timeout (5 seconds max lifetime)
  useEffect(() => {
    const failsafeTimer = setTimeout(() => {
      triggerDismiss('timeout');
    }, 5000);
    return () => clearTimeout(failsafeTimer);
  }, []);

  // 5. Drawer Opened check
  useEffect(() => {
    if (isChatOpen) {
      triggerDismiss('force');
    }
  }, [isChatOpen]);

  // 6. Partner Disconnected / Next / Left state check
  useEffect(() => {
    const activeStates = ['CONNECTED', 'SIGNALING', 'MATCHED', 'NEGOTIATING', 'READY', 'ICE_CONNECTING', 'MEDIA_READY', 'REQUESTING_MEDIA'];
    if (!activeStates.includes(status) || !partnerProfile) {
      triggerDismiss('interrupted');
    }
  }, [status, partnerProfile]);

  // 7. Click Anywhere & Escape key down close handlers
  useEffect(() => {
    const handleWindowClick = () => {
      triggerDismiss('force');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        triggerDismiss('force');
      }
    };

    window.addEventListener('click', handleWindowClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!partnerProfile) return null;

  const university = partnerProfile.matchAttributes?.university?.[0] || (partnerProfile as any).university || '';
  const city = partnerProfile.city || partnerProfile.matchAttributes?.city?.[0] || '';
  const country = partnerProfile.country || partnerProfile.matchAttributes?.country?.[0] || '';
  const locationStr = [city, country].filter(Boolean).join(', ');

  const matchedBy = matchReasonMetadata?.matchedBy || [];

  return (
    <div className={cn(
      "fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md z-[80] select-none transition-opacity duration-300",
      isFadingOut ? "opacity-0" : "opacity-100",
      (allowInteraction || isFadingOut) ? "pointer-events-none" : "pointer-events-auto"
    )}>
      <div className={cn(
        "w-full max-w-sm bg-stone-900/95 border border-amber-500/30 rounded-3xl p-6 shadow-2xl transition-all duration-500 ease-out transform",
        isVisible 
          ? "opacity-100 translate-y-0 scale-100 rotate-0 shadow-[0_0_50px_rgba(245,158,11,0.15)]" 
          : "opacity-0 translate-y-12 scale-90 rotate-1 pointer-events-none"
      )}>
        {/* Card Header Sparkle */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl animate-pulse">
            ✨
          </div>
        </div>

        {/* Status/Banner */}
        <div className="text-center mb-6">
          <span className="text-[10px] uppercase font-black tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Match Established
          </span>
        </div>

        {/* Identity Details */}
        <div className="text-center space-y-3.5 mb-6">
          <h3 className="text-2xl font-black tracking-tight text-stone-100">
            {partnerProfile.displayName || 'Guest'}
          </h3>

          {partnerProfile.bio && (
            <p className="text-xs text-stone-300 italic px-2 leading-relaxed">
              "{partnerProfile.bio}"
            </p>
          )}

          <div className="space-y-1 pt-1">
            {university && (
              <p className="text-xs text-stone-200 font-extrabold flex items-center justify-center gap-1.5">
                <span>🎓</span> {university}
              </p>
            )}

            {locationStr && (
              <p className="text-xs text-stone-400 font-medium flex items-center justify-center gap-1.5">
                <span>📍</span> {locationStr}
              </p>
            )}
          </div>
        </div>

        {/* Match Reasons List */}
        {matchedBy.length > 0 && (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2.5 mb-6">
            <span className="text-[9px] uppercase font-black tracking-wider text-stone-500 block mb-1">
              Matched because:
            </span>
            {matchedBy.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs font-bold text-stone-200">
                <span className="text-emerald-400 font-black">✓</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* Connection Checklist */}
        <div className="bg-stone-950/40 border border-white/5 rounded-2xl p-4 space-y-2 text-left">
          <span className="text-[9px] uppercase font-black tracking-wider text-stone-500 block mb-1.5">
            Connection Checklist
          </span>
          {CHECKLIST_ITEMS.slice(0, checklistIndex + 1).map((item, idx) => (
            <div
              key={idx}
              className="text-xs font-bold text-stone-300 flex items-center gap-2 animate-fade-in"
            >
              <span>{item}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
