import { useState } from 'react';
import { cn, safeLocalStorage } from '../utils/index.js';

interface QueueCardProps {
  elapsed: number;
  matchMode: string;
  isQueuePaused?: boolean;
  onOpenPreferences?: () => void;
  onResumeQueue?: () => void;
  onPauseQueue?: () => void;
  onLeaveQueue?: () => void;
  stats: { online: number; searching: number; wait: number };
  onDisableStrict?: () => void;
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
  onDisableStrict,
}: QueueCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Expose local preferences
  // Expose local preferences
  const displayName = safeLocalStorage.getItem('kaboom_display_name') || 'Guest';
  const country = safeLocalStorage.getItem('kaboom_country') || '';
  const city = safeLocalStorage.getItem('kaboom_city') || '';
  const university = safeLocalStorage.getItem('kaboom_university') || '';
  const bio = safeLocalStorage.getItem('kaboom_bio') || '';
  
  const interests: string[] = safeLocalStorage.getJSON('kaboom_interest_tags', []);
  const languages: string[] = safeLocalStorage.getJSON('kaboom_languages', []);

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
  const visibleFilters = activeFiltersList.slice(0, 2);
  const remainingFiltersCount = activeFiltersList.length - visibleFilters.length;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <div className="queue-card-container select-none text-left w-full h-full pointer-events-auto">
      <div
        className={cn(
          "queue-card-card queue-card-entrance flex flex-col gap-4",
          isQueuePaused && "border-amber-500/25 bg-amber-950/10"
        )}
      >
        {/* Row 1: Header (Always visible) */}
        <div className="queue-card-header flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <h4 className="fluid-username font-extrabold text-white truncate max-w-[140px] m-0">
              {displayName}
            </h4>
            <span className="text-stone-600 shrink-0">·</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-extrabold text-[9px] tracking-wide shrink-0">
              {matchMode === 'STRICT' ? 'Exact' : matchMode === 'PREFER' ? 'Smart' : 'Random'}
            </span>
            {isQueuePaused && (
              <span className="text-[9px] text-amber-500 font-black tracking-wider shrink-0 animate-pulse">PAUSED</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-amber-400 font-black font-mono fluid-timer shrink-0">
              ⏱️ {formatTimer(elapsed)}
            </span>
            <button
              onClick={handleToggleExpand}
              className="text-[10px] text-amber-500 hover:text-amber-400 font-black cursor-pointer p-1 transition-colors"
              aria-label="Expand detailed statistics sheet"
            >
              ▲
            </button>
          </div>
        </div>

        {/* Row 2: Bio (Priority 2, hidden on small container sizes via query) */}
        {bio && (
          <div className="queue-card-bio text-stone-400 font-medium fluid-small italic bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
            "{bio}"
          </div>
        )}

        {/* Row 3: Filters Row (Collapses spacing dynamically) */}
        <div className="queue-card-filters flex items-center gap-1.5 overflow-x-auto pr-1 scrollbar-none py-1 border-t border-white/5">
          <span className="text-stone-500 font-bold uppercase tracking-wider fluid-label shrink-0 mr-1">Filters:</span>
          {visibleFilters.map((filter, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/10 text-[9px] font-semibold tracking-wide shrink-0">
              {filter}
            </span>
          ))}
          {remainingFiltersCount > 0 && (
            <button
              onClick={handleToggleExpand}
              className="text-[9px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-full shrink-0 cursor-pointer hover:bg-amber-500/20 transition-colors"
            >
              +{remainingFiltersCount}
            </button>
          )}
          {!hasFilters && (
            <span className="text-[9px] text-stone-500 italic shrink-0">Matching anyone!</span>
          )}
        </div>

        {/* Row 4: Stats Grid (Priority 2, hidden on small containers) */}
        <div className="queue-card-stats grid grid-cols-3 gap-1.5 bg-white/[0.02] border border-white/5 rounded-xl p-2.5 text-center border-t">
          <div>
            <span className="text-[9px] text-stone-500 uppercase tracking-widest block mb-0.5">Online</span>
            <span className="font-bold text-white font-mono fluid-stats-val">{stats.online}</span>
          </div>
          <div>
            <span className="text-[9px] text-stone-500 uppercase tracking-widest block mb-0.5">Queue</span>
            <span className="font-bold text-white font-mono fluid-stats-val">{stats.searching}</span>
          </div>
          <div>
            <span className="text-[9px] text-stone-500 uppercase tracking-widest block mb-0.5">Avg Wait</span>
            <span className="font-bold text-amber-400 font-mono fluid-stats-val">{stats.wait}s</span>
          </div>
        </div>

        {/* Strict Match suggest banner (Only in STRICT mode and elapsed time is high) */}
        {matchMode === 'STRICT' && elapsed >= 15 && onDisableStrict && (
          <div className="p-2.5 mx-1 rounded-xl bg-purple-950/20 border border-purple-500/20 flex flex-col gap-1.5 text-center">
            <span className="text-[10px] text-purple-300 font-bold">
              Still looking... Most users switch to Smart Match for faster conversations.
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDisableStrict(); }}
              className="py-1.5 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[10px] font-black active:scale-95 transition-all cursor-pointer"
            >
              Switch to Smart Match
            </button>
          </div>
        )}

        {/* Row 5: Actions (Exposes compact buttons) */}
        <div className="queue-card-actions flex flex-col gap-1.5 pt-2 border-t border-white/5 w-full">
          <div className="flex gap-2 w-full">
            {onOpenPreferences && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenPreferences(); }}
                className="btn-action-edit flex-1 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-extrabold tracking-wide active:scale-95 transition-all cursor-pointer h-11"
                title="Edit Search Filters"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Edit</span>
              </button>
            )}
            {isQueuePaused ? (
              onResumeQueue && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onResumeQueue(); }}
                  className="btn-action-pause flex-1 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-extrabold tracking-wide active:scale-95 transition-all cursor-pointer h-11"
                >
                  <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Resume</span>
                </button>
              )
            ) : (
              onPauseQueue && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPauseQueue(); }}
                  className="btn-action-pause flex-1 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-extrabold tracking-wide active:scale-95 transition-all cursor-pointer h-11"
                >
                  <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  <span>Pause</span>
                </button>
              )
            )}

            {onLeaveQueue && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onLeaveQueue(); }}
                className="btn-action-cancel flex-1 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-extrabold tracking-wide active:scale-95 transition-all cursor-pointer h-11"
                title="Cancel Queue"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── EXPANDED BOTTOM SHEET OVERLAY ── */}
      {expanded && (
        <div 
          className="fixed inset-0 bg-black/85 z-[90] flex flex-col justify-end animate-fade-in pointer-events-auto select-none"
          onClick={() => setExpanded(false)}
        >
          <div
            className="w-full bg-stone-900 border-t border-white/10 rounded-t-3xl p-6 text-left flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-slide-up"
            style={{ paddingBottom: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div>
                <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block">Searching As</span>
                <h4 className="text-base font-black text-white m-0">{displayName}</h4>
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

            {/* Statistics */}
            <div className="flex flex-col text-left">
              <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Queue Stats</span>
              <div className="grid grid-cols-3 gap-1 bg-white/[0.01] border border-white/5 rounded-xl p-3 text-center text-xs">
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

            {/* Actions */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5 w-full">
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {onOpenPreferences && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExpanded(false); onOpenPreferences(); }}
                    className="py-2.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-stone-200 hover:text-white font-bold border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    ✏️ Edit Filters
                  </button>
                )}
                {isQueuePaused ? (
                  onResumeQueue && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpanded(false); onResumeQueue(); }}
                      className="py-2.5 text-xs rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      ▶️ Resume
                    </button>
                  )
                ) : (
                  onPauseQueue && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpanded(false); onPauseQueue(); }}
                      className="py-2.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      ⏸ Pause
                    </button>
                  )
                )}
              </div>

              {onLeaveQueue && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(false); onLeaveQueue(); }}
                  className="w-full py-2.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold border border-red-500/25 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  🚪 Cancel Queue
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
