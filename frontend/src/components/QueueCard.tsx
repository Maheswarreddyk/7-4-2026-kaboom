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
  const { layoutMode } = useResponsiveLayout();

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

  const hasFilters = country || city || university || interests.length > 0;

  // ── LEVEL 3: STATISTICS (Priority Level 3 — visible in FULL/COMPACT/CONDENSED/STACKED) ──
  const showStats = layoutMode !== 'MOBILE' && layoutMode !== 'MINIMAL';

  // ── LEVEL 4: DECORATIVE BIO (Priority Level 4 — visible in FULL/COMPACT) ──
  const showBio = bio && (layoutMode === 'FULL' || layoutMode === 'COMPACT');

  /* ───────────────────────────────────────────────────────────
   * 1. MOBILE / MINIMAL LAYOUTS (MOBILE, MINIMAL)
   * A highly compact, docked horizontal card that exposes ALL info:
   * Username, Search Mode, Active Filters, Timer, Edit, Pause, Leave.
   * Directly on screen, 0 clicks to access, no overlays.
   * ─────────────────────────────────────────────────────────── */
  if (layoutMode === 'MOBILE' || layoutMode === 'MINIMAL') {
    const isTiny = layoutMode === 'MOBILE';
    return (
      <div 
        className={cn(
          "w-full bg-black/80 border border-white/10 rounded-2xl p-3 text-left flex flex-col gap-2.5 glass pointer-events-auto",
          isTiny ? "text-[10px]" : "text-xs"
        )}
        style={{ maxWidth: '440px', margin: '0 auto' }}
      >
        {/* Header Row: Username, Mode, Timer */}
        <div className="flex items-center justify-between overflow-hidden gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="font-extrabold text-white truncate max-w-[90px]">{displayName}</span>
            <span className="text-stone-500 shrink-0">·</span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-extrabold text-[9px] shrink-0">
              {matchMode === 'STRICT' ? 'Exact' : matchMode === 'PREFER' ? 'Smart' : 'Random'}
            </span>
            {isQueuePaused && (
              <span className="text-[9px] text-amber-500 font-black shrink-0">⏸ PAUSED</span>
            )}
          </div>
          <span className="text-amber-400 font-bold font-mono shrink-0">
            ⏱️ {formatTimer(elapsed)}
          </span>
        </div>

        {/* Filter tags (Horizontal scrolling row so they never wrap or clip on narrow screens) */}
        <div className="flex items-center gap-1 overflow-x-auto pr-1 scrollbar-none py-0.5 border-t border-white/5 pt-1.5">
          <span className="text-stone-500 font-bold text-[8px] uppercase tracking-wider shrink-0 mr-1">Filters:</span>
          {country && <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 shrink-0">🌍 {country}</span>}
          {university && <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 shrink-0">🎓 {university}</span>}
          {interests.map((tag) => (
            <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 shrink-0">#{tag}</span>
          ))}
          {languages.map((l) => (
            <span key={l} className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 shrink-0">💬 {l}</span>
          ))}
          {!hasFilters && languages.length === 0 && (
            <span className="text-[9px] text-stone-500 italic shrink-0">Matching anyone!</span>
          )}
        </div>

        {/* Action Button Row */}
        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
          <div className="flex gap-1.5">
            {onOpenPreferences && (
              <button
                type="button"
                onClick={onOpenPreferences}
                className="py-1 px-2.5 rounded-lg bg-white/5 text-stone-300 text-[9px] border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
              >
                ✏️ Edit
              </button>
            )}
            {isQueuePaused ? (
              onResumeQueue && (
                <button
                  type="button"
                  onClick={onResumeQueue}
                  className="py-1 px-2.5 rounded-lg bg-green-600 text-white text-[9px] hover:bg-green-500 active:scale-95 transition-all"
                >
                  ▶️ Resume
                </button>
              )
            ) : (
              onPauseQueue && (
                <button
                  type="button"
                  onClick={onPauseQueue}
                  className="py-1 px-2.5 rounded-lg bg-amber-500 text-stone-950 text-[9px] hover:bg-amber-600 active:scale-95 transition-all"
                >
                  ⏸ Pause
                </button>
              )
            )}
          </div>

          {onLeaveQueue && (
            <button
              type="button"
              onClick={onLeaveQueue}
              className="py-1 px-2.5 rounded-lg bg-red-600/20 text-red-400 text-[9px] hover:bg-red-600/30 border border-red-500/20 active:scale-95 transition-all"
            >
              🚪 Leave Queue
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ───────────────────────────────────────────────────────────
   * 2. DESKTOP / TABLET / LAPTOP LAYOUTS (FULL, COMPACT, CONDENSED, STACKED)
   * Exposes full details in a robust, beautifully formatted card.
   * Spacing and size scale continuously using CSS custom properties.
   * ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col text-left glass transition-all duration-300 pointer-events-auto"
      style={{ 
        maxWidth: 'var(--queue-card-width)',
        padding: 'var(--spacing-m)',
        gap: 'var(--spacing-m)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div>
          <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block">Searching As</span>
          <h4 className="font-black text-white truncate max-w-[160px] text-medium">
            {displayName}
          </h4>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[9px] shrink-0">
            {getModeLabel(matchMode)}
          </span>
          {isQueuePaused && (
            <span className="text-[9px] text-amber-500 font-bold">⏸ Paused</span>
          )}
        </div>
      </div>

      {/* Decorative Bio (Level 4 Priority - Hidden on Stacked/Condensed/Minimal/Mobile) */}
      {showBio && (
        <div className="text-[10px] text-stone-400 italic bg-white/[0.01] p-1.5 rounded-lg border border-white/5">
          "{bio}"
        </div>
      )}

      {/* Info Grid */}
      <div className={cn("grid gap-2", showStats ? "grid-cols-2" : "grid-cols-1")}>
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
            {!hasFilters && languages.length === 0 && (
              <span className="text-[9px] text-stone-500 italic">Matching anyone!</span>
            )}
          </div>
        </div>

        {/* Statistics Grid (Level 3 Priority - Hidden in Minimal/Mobile) */}
        {showStats && (
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
        )}
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
              ✏️ Edit Filters
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
