import { useState } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { cn } from '../utils/index.js';

interface QueueCardProps {
  elapsed: number;
  matchMode: string;
  isQueuePaused?: boolean;
  onOpenPreferences?: () => void;
  onResumeQueue?: () => void;
  onPauseQueue?: () => void;
  onLeaveQueue?: () => void;
  stats: { online: number; searching: number; wait: number };
}

export function QueueCard({
  elapsed,
  matchMode,
  isQueuePaused = false,
  onOpenPreferences,
  onResumeQueue,
  onPauseQueue,
  onLeaveQueue,
  stats,
}: QueueCardProps) {
  const { queueCardMode, safeArea } = useResponsiveLayout();
  const [expandedMobile, setExpandedMobile] = useState(false);

  // Expose local preferences
  const displayName = localStorage.getItem('kaboom_display_name') || 'Guest';
  const country = localStorage.getItem('kaboom_country') || '';
  const city = localStorage.getItem('kaboom_city') || '';
  const university = localStorage.getItem('kaboom_university') || '';
  const bio = localStorage.getItem('kaboom_bio') || '';
  const interests: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]');
    } catch {
      return [];
    }
  })();
  const languages: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('kaboom_languages') || '[]');
    } catch {
      return [];
    }
  })();

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'STRICT': return '🔒 Exact Match';
      case 'PREFER': return '🎯 Smart Match';
      default: return '🌍 Random Match';
    }
  };

  /* ────────── 1 & 2: DESKTOP / COMPACT CARD LAYOUTS ────────── */
  if (queueCardMode === 'desktop' || queueCardMode === 'compact' || queueCardMode === 'small-laptop') {
    const isCompact = queueCardMode === 'compact';
    const isSmallLaptop = queueCardMode === 'small-laptop';

    return (
      <div 
        className={cn(
          "w-full bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col text-left glass transition-all duration-300 pointer-events-auto",
          isSmallLaptop ? "p-3 gap-2 text-[11px]" : isCompact ? "p-4 gap-3 text-xs" : "p-5 gap-4 text-sm"
        )}
        style={{ width: 'var(--queue-card-width)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div>
            <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block">Searching As</span>
            <h4 className={cn("font-black text-white truncate", isSmallLaptop ? "max-w-[120px] text-xs" : "max-w-[160px] text-sm")}>
              {displayName}
            </h4>
          </div>
          <span className={cn("px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[9px] shrink-0")}>
            {getModeLabel(matchMode)}
          </span>
        </div>

        {/* Bio if exists */}
        {bio && !isSmallLaptop && (
          <div className="text-[10px] text-stone-400 italic bg-white/[0.01] p-1.5 rounded-lg border border-white/5">
            "{bio}"
          </div>
        )}

        {/* Info Grid */}
        <div className={cn("grid gap-2", isCompact || isSmallLaptop ? "grid-cols-2" : "grid-cols-1")}>
          <div>
            <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Active Criteria</span>
            <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto pr-1">
              {country && <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">🌍 {country}</span>}
              {city && <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">📍 {city}</span>}
              {university && <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">🎓 {university}</span>}
              {interests.map((tag) => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">#{tag}</span>
              ))}
              {languages.map((l) => (
                <span key={l} className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">🗣️ {l}</span>
              ))}
              {!country && !city && !university && interests.length === 0 && (
                <span className="text-[10px] text-stone-500 italic">Matching anyone!</span>
              )}
            </div>
          </div>

          <div>
            <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Queue Stats</span>
            <div className="grid grid-cols-3 gap-1 bg-white/[0.01] border border-white/5 rounded-xl p-2 text-center text-[10px]">
              <div>
                <span className="text-[8px] text-stone-500 block">Online</span>
                <span className="font-bold text-white font-mono">{stats.online}</span>
              </div>
              <div>
                <span className="text-[8px] text-stone-500 block">Queue</span>
                <span className="font-bold text-white font-mono">{stats.searching}</span>
              </div>
              <div>
                <span className="text-[8px] text-stone-500 block">Time</span>
                <span className="font-bold text-amber-400 font-mono">{formatTimer(elapsed)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Row */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
          <div className="grid grid-cols-2 gap-1.5">
            {onOpenPreferences && (
              <button
                type="button"
                onClick={onOpenPreferences}
                className="py-2 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-200 hover:text-white font-bold text-[10px] border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
              >
                ✏️ Edit
              </button>
            )}
            {isQueuePaused ? (
              onResumeQueue && (
                <button
                  type="button"
                  onClick={onResumeQueue}
                  className="py-2 px-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-[10px] transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  ▶️ Resume
                </button>
              )
            ) : (
              onPauseQueue && (
                <button
                  type="button"
                  onClick={onPauseQueue}
                  className="py-2 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-[10px] transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  ⏸️ Pause
                </button>
              )
            )}
          </div>

          {onLeaveQueue && (
            <button
              type="button"
              onClick={onLeaveQueue}
              className="w-full py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-[10px] border border-red-500/25 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
            >
              🚪 Leave Queue
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ────────── 3: TABLET CARD LAYOUT (Floating Compact Card) ────────── */
  if (queueCardMode === 'tablet') {
    return (
      <div className="w-full max-w-[440px] bg-black/75 backdrop-blur-2xl border border-white/10 rounded-2xl p-3.5 shadow-2xl text-left flex flex-col gap-2.5 pointer-events-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-black text-white">{displayName}</span>
            <span className="text-[10px] text-stone-400 font-bold">({getModeLabel(matchMode)})</span>
          </div>
          <span className="text-[10px] text-amber-400 font-bold font-mono">
            ⏱️ {formatTimer(elapsed)}
          </span>
        </div>

        {/* Inline Active Filters tags */}
        <div className="flex flex-wrap gap-1">
          {country && <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5">🌍 {country}</span>}
          {university && <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5">🎓 {university}</span>}
          {interests.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5">#{tag}</span>
          ))}
          {interests.length > 3 && <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-400">+{interests.length - 3} more</span>}
        </div>

        {/* Buttons and Stats combined in single row */}
        <div className="flex items-center justify-between border-t border-white/5 pt-2.5 gap-2">
          <div className="flex items-center gap-1.5">
            {onOpenPreferences && (
              <button
                type="button"
                onClick={onOpenPreferences}
                className="py-1 px-2.5 rounded-lg bg-white/5 text-stone-300 text-[10px] border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
              >
                Filters
              </button>
            )}
            {isQueuePaused ? (
              onResumeQueue && (
                <button
                  type="button"
                  onClick={onResumeQueue}
                  className="py-1 px-2.5 rounded-lg bg-green-600 text-white text-[10px] hover:bg-green-500 active:scale-95 transition-all"
                >
                  Resume
                </button>
              )
            ) : (
              onPauseQueue && (
                <button
                  type="button"
                  onClick={onPauseQueue}
                  className="py-1 px-2.5 rounded-lg bg-amber-500 text-stone-950 text-[10px] hover:bg-amber-600 active:scale-95 transition-all"
                >
                  Pause
                </button>
              )
            )}
            {onLeaveQueue && (
              <button
                type="button"
                onClick={onLeaveQueue}
                className="py-1 px-2.5 rounded-lg bg-red-600/20 text-red-400 text-[10px] hover:bg-red-600/30 border border-red-500/20 active:scale-95 transition-all"
              >
                Leave
              </button>
            )}
          </div>

          <div className="text-[9px] text-stone-400 font-bold uppercase flex gap-2">
            <span>Online: {stats.online}</span>
            <span>Queue: {stats.searching}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ────────── 4: MOBILE CARD LAYOUT (Collapsed Bottom Sheet) ────────── */
  return (
    <>
      <div 
        onClick={() => setExpandedMobile(true)}
        className="w-full bg-black/75 border border-white/10 rounded-2xl p-4 flex items-center justify-between text-left glass cursor-pointer hover:bg-white/5 transition-all active:scale-[0.98] select-none pointer-events-auto"
      >
        <div className="flex items-center gap-3 text-xs font-bold text-stone-200 overflow-hidden">
          <span className="truncate max-w-[70px]">👤 {displayName}</span>
          <span className="w-1 h-1 rounded-full bg-stone-700 shrink-0" />
          <span className="shrink-0">🎯 {matchMode === 'STRICT' ? 'Exact' : matchMode === 'PREFER' ? 'Smart' : 'Random'}</span>
          {university && (
            <>
              <span className="w-1 h-1 rounded-full bg-stone-700 shrink-0" />
              <span className="truncate max-w-[80px]">🎓 {university}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-amber-400 font-mono font-bold">{formatTimer(elapsed)}</span>
          <span className="text-amber-500 font-bold text-xs animate-bounce">▲</span>
        </div>
      </div>

      {expandedMobile && (
        <div className="fixed inset-0 bg-black/75 z-[100] flex flex-col justify-end animate-fade-in select-none pointer-events-auto">
          <div 
            className="w-full bg-stone-900 border-t border-white/10 rounded-t-3xl p-6 text-left flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-slide-up"
            style={{ paddingBottom: `calc(${safeArea.bottom}px + 24px)` }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div>
                <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block">Searching As</span>
                <h4 className="text-base font-black text-white">{displayName}</h4>
              </div>
              <button 
                onClick={() => setExpandedMobile(false)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-stone-400 hover:text-white"
              >
                ▼
              </button>
            </div>

            <div className="space-y-4">
              {bio && (
                <div>
                  <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Bio</span>
                  <p className="text-xs text-stone-300 italic">"{bio}"</p>
                </div>
              )}

              <div>
                <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block mb-2">Search Criteria</span>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[9px] px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold rounded-full">
                    🎯 Mode: {matchMode === 'STRICT' ? 'Exact' : matchMode === 'PREFER' ? 'Smart' : 'Random'}
                  </span>
                  {university && <span className="text-[9px] px-2.5 py-1 bg-white/5 border border-white/5 text-stone-300 font-semibold rounded-full">🎓 {university}</span>}
                  {country && <span className="text-[9px] px-2.5 py-1 bg-white/5 border border-white/5 text-stone-300 font-semibold rounded-full">🌍 {country}</span>}
                  {city && <span className="text-[9px] px-2.5 py-1 bg-white/5 border border-white/5 text-stone-300 font-semibold rounded-full">📍 {city}</span>}
                  {interests.map((tag) => (
                    <span key={tag} className="text-[9px] px-2.5 py-1 bg-white/5 border border-white/5 text-stone-300 font-semibold rounded-full">#{tag}</span>
                  ))}
                  {languages.map((l) => (
                    <span key={l} className="text-[9px] px-2.5 py-1 bg-white/5 border border-white/5 text-stone-300 font-semibold rounded-full">🗣️ {l}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                <div>
                  <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Online</span>
                  <span className="text-xs font-black text-white font-mono">{stats.online}</span>
                </div>
                <div>
                  <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block mb-1">In Queue</span>
                  <span className="text-xs font-black text-white font-mono">{stats.searching}</span>
                </div>
                <div>
                  <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Wait Time</span>
                  <span className="text-xs font-black text-white font-mono">{elapsed}s</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <div className="grid grid-cols-2 gap-2">
                {onOpenPreferences && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedMobile(false);
                      onOpenPreferences();
                    }}
                    className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-stone-200 hover:text-white font-bold text-xs border border-white/10 flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    ✏️ Edit Filters
                  </button>
                )}
                {isQueuePaused ? (
                  onResumeQueue && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMobile(false);
                        onResumeQueue();
                      }}
                      className="py-3 px-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      ▶️ Resume
                    </button>
                  )
                ) : (
                  onPauseQueue && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMobile(false);
                        onPauseQueue();
                      }}
                      className="py-3 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      ⏸️ Pause
                    </button>
                  )
                )}
              </div>
              {onLeaveQueue && (
                <button
                  type="button"
                  onClick={() => {
                    setExpandedMobile(false);
                    onLeaveQueue();
                  }}
                  className="w-full py-3 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs border border-red-500/25 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  🚪 Leave Queue
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
