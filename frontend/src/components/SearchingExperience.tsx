import { useEffect, useState } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { QueueCard } from './QueueCard.js';
import { cn } from '../utils/index.js';

interface SearchingExperienceProps {
  status: string;
  partnerProfile?: any;
  isQueuePaused?: boolean;
  elapsed: number;
  matchMode: string;
  onOpenPreferences?: () => void;
  onResumeQueue?: () => void;
  onPauseQueue?: () => void;
  onLeaveQueue?: () => void;
  stats: { online: number; searching: number; wait: number };
  onDisableStrict?: () => void;
}

export function SearchingExperience({
  status,
  partnerProfile,
  isQueuePaused = false,
  elapsed,
  matchMode,
  onOpenPreferences,
  onResumeQueue,
  onPauseQueue,
  onLeaveQueue,
  stats,
  onDisableStrict,
}: SearchingExperienceProps) {
  const { width, height } = useResponsiveLayout();
  const isMinimalLayout = width < 560 || height < 550;

  const activeMatchMode = localStorage.getItem('kaboom_match_mode') || 'RANDOM';
  const university = localStorage.getItem('kaboom_university') || '';

  const [animationStep, setAnimationStep] = useState(0);

  // Rotating messages during search stages
  useEffect(() => {
    if (status === 'PARTNER_LEFT' || isQueuePaused) return;
    const interval = setInterval(() => {
      setAnimationStep((prev) => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [status, isQueuePaused]);

  const randomMessages = [
    "🌍 Searching worldwide...",
    "👥 Checking active users...",
    "⚡ Finding someone online...",
    "✨ Finding your next conversation..."
  ];

  const smartMessages = [
    "🎵 Looking for shared interests...",
    "🎓 Checking universities...",
    "📍 Searching nearby...",
    "🤝 Matching shared preferences..."
  ];

  const strictMessages = [
    "🔒 Searching exact matches...",
    "📝 Checking your selected filters...",
    university ? `🏫 Waiting for another ${university} student...` : "🏫 Searching selected campus network...",
    "⚠️ Exact matching takes slightly longer..."
  ];

  const getRotatingMessages = () => {
    if (activeMatchMode === 'STRICT') return strictMessages;
    if (activeMatchMode === 'PREFER') return smartMessages;
    return randomMessages;
  };

  const currentMessages = getRotatingMessages();
  const currentStageText = currentMessages[animationStep % currentMessages.length];

  const getStageColor = (step: number) => {
    const stage = step % 4;
    switch (stage) {
      case 0: return { border: 'border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/10', ping: 'border-amber-500/10' };
      case 1: return { border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/10', ping: 'border-purple-500/10' };
      case 2: return { border: 'border-cyan-500/30', text: 'text-cyan-400', bg: 'bg-cyan-500/10', ping: 'border-cyan-500/10' };
      default: return { border: 'border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/10', ping: 'border-emerald-500/10' };
    }
  };

  const colors = getStageColor(animationStep);

  return (
    <div className="searching-experience-root w-full h-full flex flex-col items-center justify-center relative select-none">

      {/* Unified Waiting Room Content Column */}
      <div className={cn(
        "relative z-10 flex flex-col items-center w-full max-w-[380px] mx-auto px-4 text-center transition-all duration-500",
        isMinimalLayout ? "gap-4" : "gap-6"
      )}>
        {status === 'PARTNER_LEFT' ? (
          <div className="flex flex-col items-center animate-fade-in w-full">
            <div className="w-16 h-16 rounded-full border border-red-500/25 bg-red-500/5 flex items-center justify-center relative shadow-2xl mb-4">
              <span className="text-2xl animate-bounce">👋</span>
            </div>
            <p className="text-red-400 font-extrabold text-base tracking-tight mb-1">
              {partnerProfile?.displayName || 'Partner'} left.
            </p>
            <p className="text-stone-400 text-xs font-semibold tracking-wide animate-pulse mb-4">
              Finding another person...
            </p>
          </div>
        ) : isQueuePaused ? (
          <div className="flex flex-col items-center animate-fade-in w-full">
            <div className="w-16 h-16 rounded-full border border-amber-500/20 bg-amber-500/5 flex items-center justify-center relative shadow-2xl mb-4">
              <span className="text-2xl">⏸️</span>
            </div>
            <p className="text-amber-500 font-extrabold text-base tracking-tight mb-1">
              Matchmaking Paused
            </p>
            <p className="text-stone-400 text-xs font-semibold tracking-wide mb-4">
              Resume matching when you are ready
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            {/* Center Radar Animation */}
            <div className={cn("relative animate-fade-in shrink-0", isMinimalLayout ? "mb-1" : "mb-4")}>
              <div className={`absolute inset-0 rounded-full border ${colors.ping} animate-ping`} style={{ animationDuration: '3s' }} />
              <div className={cn("rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center relative shadow-2xl glass", isMinimalLayout ? "w-12 h-12" : "w-16 h-16")}>
                <div className={cn("absolute rounded-full border", colors.border, colors.bg, "animate-pulse", isMinimalLayout ? "w-8 h-8" : "w-11 h-11")} />
                <div className={cn("rounded-xl border flex items-center justify-center font-bold animate-spin", colors.bg, colors.border, colors.text, isMinimalLayout ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs")} style={{ animationDuration: '8s' }}>
                  ✦
                </div>
              </div>
            </div>

            {/* Rotating match stage text */}
            <p className="text-stone-100 font-extrabold text-xs tracking-tight mb-2 h-5 overflow-hidden transition-all duration-300 shrink-0">
              {currentStageText}
            </p>

            {/* Jump loader dots */}
            <div className="flex items-center justify-center gap-1 shrink-0 mb-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-amber-500/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Cohesive Queue Card Block */}
        <div className="w-full shrink-0">
          <QueueCard
            elapsed={elapsed}
            matchMode={matchMode}
            isQueuePaused={isQueuePaused}
            onOpenPreferences={onOpenPreferences}
            onResumeQueue={onResumeQueue}
            onPauseQueue={onPauseQueue}
            onLeaveQueue={onLeaveQueue}
            stats={stats}
            onDisableStrict={onDisableStrict}
          />
        </div>
      </div>
    </div>
  );
}
