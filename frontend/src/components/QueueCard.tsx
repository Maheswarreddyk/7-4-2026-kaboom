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
  const { layoutMode, safeArea } = useResponsiveLayout();
  const [expanded, setExpanded] = useState(false);

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
      case 'STRICT': return '🔒 Exact';
      case 'PREFER': return '🎯 Smart';
      default: return '🌍 Random';
    }
  };

  // Compile active filters list
  const activeFiltersList: string[] = [];
  if (country) activeFiltersList.push(`🌍 ${country}`);
  if (city) activeFiltersList.push(`📍 ${city}`);
  if (university) activeFiltersList.push(`🎓 ${university}`);
  interests.forEach(t => activeFiltersList.push(`#${t}`));
  languages.forEach(l => activeFiltersList.push(`💬 ${l}`));

  const hasFilters = activeFiltersList.length > 0;
  
  // Show first 2 filters, remaining mapped as count badge
  const visibleFilters = activeFiltersList.slice(0, 2);
  const remainingFiltersCount = activeFiltersList.length - visibleFilters.length;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  /* ───────────────────────────────────────────────────────────
   * SUB-COMPONENT: QueueHeader
   * ─────────────────────────────────────────────────────────── */
  const QueueHeader = ({ isMinimal = false }: { isMinimal?: boolean }) => (
    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
      <div className="flex flex-col text-left">
        <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block">Searching As</span>
        <h4 className={cn("font-black text-white truncate", isMinimal ? "max-w-[100px] text-[11px]" : "max-w-[160px] text-medium")}>
          {displayName}
        </h4>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[9px] shrink-0">
          {getModeLabel(matchMode)}
        </span>
        {isQueuePaused && (
          <span className="text-[8px] text-amber-500 font-black animate-pulse">PAUSED</span>
        )}
      </div>
    </div>
  );

  /* ───────────────────────────────────────────────────────────
   * SUB-COMPONENT: QueueFilters
   * ─────────────────────────────────────────────────────────── */
  const QueueFilters = ({ isMinimal: _isMinimal = false }: { isMinimal?: boolean }) => (
    <div className="flex flex-col text-left">
      <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Search Criteria</span>
      <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto pr-1">
        {visibleFilters.map((filter, idx) => (
          <span key={idx} className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 shrink-0 font-medium">
            {filter}
          </span>
        ))}
        {remainingFiltersCount > 0 && (
          <button
            onClick={handleToggleExpand}
            className="text-[9px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-full cursor-pointer hover:bg-amber-500/20 active:scale-95 transition-all"
          >
            +{remainingFiltersCount} more
          </button>
        )}
        {!hasFilters && (
          <span className="text-[9px] text-stone-500 italic">Matching anyone!</span>
        )}
      </div>
    </div>
  );

  /* ───────────────────────────────────────────────────────────
   * SUB-COMPONENT: QueueStats
   * ─────────────────────────────────────────────────────────── */
  const QueueStats = () => (
    <div className="flex flex-col text-left">
      <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Queue Stats</span>
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
  );

  /* ───────────────────────────────────────────────────────────
   * SUB-COMPONENT: QueueActions
   * ─────────────────────────────────────────────────────────── */
  const QueueActions = ({ isMinimal = false }: { isMinimal?: boolean }) => (
    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5 w-full">
      <div className="grid grid-cols-2 gap-1.5 w-full">
        {onOpenPreferences && (
          <button
            type="button"
            onClick={onOpenPreferences}
            className={cn(
              "rounded-lg bg-white/5 hover:bg-white/10 text-stone-200 hover:text-white font-bold border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer",
              isMinimal ? "py-1 text-[9px]" : "py-2 text-[10px]"
            )}
          >
            ✏️ Edit Filters
          </button>
        )}
        {isQueuePaused ? (
          onResumeQueue && (
            <button
              type="button"
              onClick={onResumeQueue}
              className={cn(
                "rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer",
                isMinimal ? "py-1 text-[9px]" : "py-2 text-[10px]"
              )}
            >
              ▶️ Resume
            </button>
          )
        ) : (
          onPauseQueue && (
            <button
              type="button"
              onClick={onPauseQueue}
              className={cn(
                "rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer",
                isMinimal ? "py-1 text-[9px]" : "py-2 text-[10px]"
              )}
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
          className={cn(
            "w-full rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold border border-red-500/25 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer",
            isMinimal ? "py-1 text-[9px]" : "py-1.5 text-[10px]"
          )}
        >
          🚪 Cancel Queue
        </button>
      )}
    </div>
  );

  /* ───────────────────────────────────────────────────────────
   * 1. MOBILE EXPANDED MODAL PANEL (Sheet Overlay)
   * ─────────────────────────────────────────────────────────── */
  if (expanded) {
    return (
      <div 
        className="fixed inset-0 bg-black/85 z-[90] flex flex-col justify-end animate-fade-in pointer-events-auto select-none"
        onClick={() => setExpanded(false)}
      >
        <div
          className="w-full bg-stone-900 border-t border-white/10 rounded-t-3xl p-6 text-left flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-slide-up"
          style={{ paddingBottom: `calc(${safeArea.bottom}px + 24px)` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div>
              <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block">Searching As</span>
              <h4 className="text-base font-black text-white">{displayName}</h4>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-stone-400 hover:text-white"
            >
              ▼
            </button>
          </div>

          {bio && (
            <div>
              <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Bio</span>
              <p className="text-xs text-stone-300 italic">"{bio}"</p>
            </div>
          )}

          {/* Full active criteria tags */}
          <div>
            <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block mb-2">Search Criteria</span>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[9px] px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold rounded-full">
                🎯 Mode: {getModeLabel(matchMode)}
              </span>
              {activeFiltersList.map((tag, idx) => (
                <span key={idx} className="text-[9px] px-2.5 py-1 bg-white/5 border border-white/5 text-stone-300 font-semibold rounded-full">
                  {tag}
                </span>
              ))}
              {!hasFilters && (
                <span className="text-[9px] text-stone-500 italic">Matching anyone!</span>
              )}
            </div>
          </div>

          <QueueStats />
          <QueueActions />
        </div>
      </div>
    );
  }

  /* ───────────────────────────────────────────────────────────
   * 2. MINIMAL / COMPACT SPACE STATE LAYOUTS
   * A single horizontal row bar. Contains Username, Mode, Timer,
   * active filters row, and direct ✏️/⏸️/🚪 buttons.
   * ─────────────────────────────────────────────────────────── */
  if (layoutMode === 'Minimal' || layoutMode === 'Compact') {
    const isTiny = layoutMode === 'Minimal';
    return (
      <div
        className={cn(
          "w-full bg-black/85 border border-white/10 rounded-2xl p-3 text-left flex flex-col gap-2 glass pointer-events-auto shadow-2xl transition-all duration-300",
          isTiny ? "text-[10px]" : "text-xs"
        )}
        style={{ maxWidth: '440px', margin: '0 auto' }}
      >
        {/* Row 1: Username, Mode, Timer, Expand Arrow */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="font-extrabold text-white truncate max-w-[100px]">{displayName}</span>
            <span className="text-stone-500 shrink-0">·</span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-extrabold text-[8px] shrink-0">
              {matchMode === 'STRICT' ? 'Exact' : matchMode === 'PREFER' ? 'Smart' : 'Random'}
            </span>
            {isQueuePaused && (
              <span className="text-[8px] text-amber-500 font-black shrink-0">PAUSED</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-amber-400 font-bold font-mono">
              ⏱️ {formatTimer(elapsed)}
            </span>
            <button
              onClick={handleToggleExpand}
              className="text-[9px] text-amber-500 font-bold animate-bounce cursor-pointer p-0.5"
              aria-label="Expand detailed statistics sheet"
            >
              ▲
            </button>
          </div>
        </div>

        {/* Row 2: Scrollable Filters indicator */}
        <div className="flex items-center gap-1 overflow-x-auto pr-1 scrollbar-none py-0.5 border-t border-white/5 pt-1">
          <span className="text-stone-500 font-bold text-[8px] uppercase tracking-wider shrink-0 mr-1">Filters:</span>
          {visibleFilters.map((filter, idx) => (
            <span key={idx} className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 shrink-0 font-medium">
              {filter}
            </span>
          ))}
          {remainingFiltersCount > 0 && (
            <button
              onClick={handleToggleExpand}
              className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-full shrink-0"
            >
              +{remainingFiltersCount}
            </button>
          )}
          {!hasFilters && (
            <span className="text-[9px] text-stone-500 italic shrink-0">Matching anyone!</span>
          )}
        </div>

        {/* Row 3: Quick Direct Actions Group (✏️, ⏸️, 🚪) */}
        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-1.5">
          <div className="flex gap-1.5">
            {onOpenPreferences && (
              <button
                type="button"
                onClick={onOpenPreferences}
                className="py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 text-[9px] border border-white/10 active:scale-95 transition-all cursor-pointer"
                title="Edit Search Filters"
              >
                ✏️ Edit
              </button>
            )}
            {isQueuePaused ? (
              onResumeQueue && (
                <button
                  type="button"
                  onClick={onResumeQueue}
                  className="py-1 px-2.5 rounded-lg bg-green-600 text-white text-[9px] hover:bg-green-500 active:scale-95 transition-all cursor-pointer font-bold"
                >
                  ▶️ Resume
                </button>
              )
            ) : (
              onPauseQueue && (
                <button
                  type="button"
                  onClick={onPauseQueue}
                  className="py-1 px-2.5 rounded-lg bg-amber-500 text-stone-950 text-[9px] hover:bg-amber-600 active:scale-95 transition-all cursor-pointer font-bold"
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
              className="py-1 px-2.5 rounded-lg bg-red-600/20 text-red-400 text-[9px] hover:bg-red-600/30 border border-red-500/20 active:scale-95 transition-all cursor-pointer font-bold"
              title="Cancel Queue"
            >
              🚪 Cancel Queue
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ───────────────────────────────────────────────────────────
   * 3. COMFORTABLE / MEDIUM SPACE STATE LAYOUTS
   * A full vertical card where children stack and rearrange dynamically.
   * ─────────────────────────────────────────────────────────── */
  const isMedium = layoutMode === 'Medium';

  return (
    <div
      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col text-left glass transition-all duration-300 pointer-events-auto"
      style={{ 
        maxWidth: 'var(--queue-card-width)',
        padding: 'var(--spacing-m)',
        gap: 'var(--spacing-m)'
      }}
    >
      <QueueHeader isMinimal={isMedium} />

      {bio && !isMedium && (
        <div className="text-[10px] text-stone-400 italic bg-white/[0.01] p-1.5 rounded-lg border border-white/5">
          "{bio}"
        </div>
      )}

      {/* Grid reflow based on available space */}
      <div className={cn("grid gap-2.5", isMedium ? "grid-cols-1" : "grid-cols-2")}>
        <QueueFilters isMinimal={isMedium} />
        <QueueStats />
      </div>

      <QueueActions isMinimal={isMedium} />
    </div>
  );
}
