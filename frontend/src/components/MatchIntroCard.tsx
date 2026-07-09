import { useEffect, useState } from 'react';
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
  };
  matchReasonMetadata?: {
    reason: 'strict_filters' | 'prefer_filters' | 'random';
    confidence: number;
    matchedBy: string[];
  } | null;
  onDismiss: () => void;
}

export function MatchIntroCard({ partnerProfile, matchReasonMetadata, onDismiss }: MatchIntroCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small timeout for entering slide-up animation
    const enterTimer = setTimeout(() => setIsVisible(true), 50);
    
    // Auto-dismiss after 3 seconds
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 400); // Wait for transition out
    }, 3200);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  const university = partnerProfile.matchAttributes?.university?.[0] || (partnerProfile as any).university || '';
  const city = partnerProfile.city || partnerProfile.matchAttributes?.city?.[0] || '';
  const country = partnerProfile.country || partnerProfile.matchAttributes?.country?.[0] || '';
  const locationStr = [city, country].filter(Boolean).join(', ');

  const matchedBy = matchReasonMetadata?.matchedBy || [];

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md z-[80] select-none pointer-events-none transition-opacity duration-300">
      <div className={cn(
        "w-full max-w-sm bg-stone-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-2xl transition-all duration-500 ease-out transform",
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
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2.5">
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

        {/* Bottom Connecting status */}
        <div className="mt-6 flex items-center justify-center gap-2 text-stone-500 text-[10px] font-black uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          <span>Setting up video tunnel...</span>
        </div>

      </div>
    </div>
  );
}
