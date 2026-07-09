import { useEffect, useState, useRef } from 'react';

interface SearchingAnimationProps {
  queuePosition?: number;
  matchMode?: string;
  onDisableStrict?: () => void;
  onOpenPreferences?: () => void;
  status?: string;
  partnerProfile?: any;
  isQueuePaused?: boolean;
  onLeaveQueue?: () => void;
}

export function SearchingAnimation({
  matchMode,
  onDisableStrict,
  onOpenPreferences,
  status,
  partnerProfile,
  isQueuePaused,
  onLeaveQueue
}: SearchingAnimationProps) {
  const [elapsed, setElapsed] = useState(0);
  const [animationStep, setAnimationStep] = useState(0);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [stats, setStats] = useState({ online: 127, searching: 41, wait: 8 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Expose local preference cache state
  const [prefData, setPrefData] = useState({
    displayName: localStorage.getItem('kaboom_display_name') || 'Guest',
    country: localStorage.getItem('kaboom_country') || '',
    city: localStorage.getItem('kaboom_city') || '',
    university: localStorage.getItem('kaboom_university') || '',
    interests: (() => {
      try {
        return JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]');
      } catch {
        return [];
      }
    })()
  });

  const activeMatchMode = matchMode || localStorage.getItem('kaboom_match_mode') || 'RANDOM';

  // Update preferences state and reset wait timer when search resumes
  useEffect(() => {
    if (!isQueuePaused) {
      setPrefData({
        displayName: localStorage.getItem('kaboom_display_name') || 'Guest',
        country: localStorage.getItem('kaboom_country') || '',
        city: localStorage.getItem('kaboom_city') || '',
        university: localStorage.getItem('kaboom_university') || '',
        interests: (() => {
          try {
            return JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]');
          } catch {
            return [];
          }
        })()
      });
      setElapsed(0);
    }
  }, [isQueuePaused]);

  // Reset timer on matchMode or status changes
  useEffect(() => {
    setElapsed(0);
  }, [activeMatchMode, status]);

  // Format wait timer (e.g. 00:15)
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Clock ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Matching stage text rotation (every 1.5 seconds)
  useEffect(() => {
    if (status === 'PARTNER_LEFT' || isQueuePaused) return;
    const interval = setInterval(() => {
      setAnimationStep((prev) => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [status, isQueuePaused]);

  // Live stats fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        online: Math.max(90, Math.min(220, prev.online + Math.floor(Math.random() * 9) - 4)),
        searching: Math.max(15, Math.min(75, prev.searching + Math.floor(Math.random() * 7) - 3)),
        wait: Math.max(5, Math.min(15, prev.wait + Math.floor(Math.random() * 3) - 1))
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // HTML5 Canvas Ambient Particle Network & Nodes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    class Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2.5 + 1.0;
        this.speedY = Math.random() * 0.4 - 0.2;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.opacity = Math.random() * 0.6 + 0.2;
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;

        if (this.x < 0 || this.x > width) this.speedX *= -1;
        if (this.y < 0 || this.y > height) this.speedY *= -1;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${this.opacity})`;
        ctx.fill();
      }
    }

    const particlesArray: Particle[] = Array.from({ length: 40 }).map(() => new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const time = Date.now() * 0.001;
      const glowX = width / 2 + Math.sin(time) * 100;
      const glowY = height / 2.5 + Math.cos(time * 0.8) * 80;

      const gradient = ctx.createRadialGradient(glowX, glowY, 50, glowX, glowY, 400);
      gradient.addColorStop(0, 'rgba(255, 91, 53, 0.05)');
      gradient.addColorStop(0.5, 'rgba(245, 166, 35, 0.03)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a + 1; b < particlesArray.length; b++) {
          const dx = particlesArray[a].x - particlesArray[b].x;
          const dy = particlesArray[a].y - particlesArray[b].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
            ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
            const lineOpacity = (1 - dist / 130) * 0.15;
            ctx.strokeStyle = `rgba(245, 158, 11, ${lineOpacity})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      particlesArray.forEach((p) => {
        p.update();
        p.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Mode-Specific rotating messages
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
    prefData.university ? `🏫 Waiting for another ${prefData.university} student...` : "🏫 Searching selected campus network...",
    "⚠️ Exact matching takes slightly longer..."
  ];

  const getRotatingMessages = () => {
    if (activeMatchMode === 'STRICT') return strictMessages;
    if (activeMatchMode === 'PREFER') return smartMessages;
    return randomMessages;
  };

  const currentMessages = getRotatingMessages();
  const currentStageText = currentMessages[animationStep % currentMessages.length];

  // Dynamic colors for matching stages
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

  // Renamed mode formatting
  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'STRICT': return '🔒 Exact Match';
      case 'PREFER': return '🎯 Smart Match';
      default: return '🌍 Random';
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-stone-950 px-4">
      {/* Background Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* ── DESKTOP "SEARCHING AS" CARD ─────────────────── */}
      {status !== 'PARTNER_LEFT' && (
        <div className="hidden sm:flex absolute top-16 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white/[0.02] border border-white/10 rounded-2xl p-4 backdrop-blur-xl z-20 shadow-2xl flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Searching As</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Queue Active</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white">{prefData.displayName}</h4>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold">
              {getModeLabel(activeMatchMode)}
            </span>
          </div>

          {/* Active preference chips */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {prefData.country && <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">🌍 {prefData.country}</span>}
            {prefData.city && <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">📍 {prefData.city}</span>}
            {prefData.university && <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">🎓 {prefData.university}</span>}
            {prefData.interests.slice(0, 2).map((item: string) => (
              <span key={item} className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">#{item}</span>
            ))}
          </div>

          {onOpenPreferences && (
            <button
              onClick={onOpenPreferences}
              className="mt-2 text-center text-[10px] py-1.5 hover:bg-white/5 text-amber-400 font-extrabold border border-amber-500/20 bg-amber-500/5 rounded-xl transition-all"
            >
              ✏️ Edit Filters
            </button>
          )}
        </div>
      )}

      {/* ── MOBILE COLLAPSIBLE "SEARCHING AS" CARD ────────── */}
      {status !== 'PARTNER_LEFT' && (
        <div 
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="absolute top-20 left-1/2 -translate-x-1/2 w-[92%] bg-stone-900/80 border border-white/10 rounded-2xl p-3 backdrop-blur-xl z-20 shadow-2xl flex sm:hidden flex-col gap-2 cursor-pointer transition-all duration-300"
        >
          {!mobileExpanded ? (
            /* Collapsed view */
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-extrabold text-stone-100">{prefData.displayName}</span>
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                  ({getModeLabel(activeMatchMode).split(' ').pop()})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-amber-400 font-black font-mono">
                  ⏱ {elapsed}s
                </span>
                <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          ) : (
            /* Expanded view */
            <div className="flex flex-col gap-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider">Searching As</span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-amber-400 font-black font-mono">
                    ⏱ Waiting {elapsed}s
                  </span>
                  <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="text-sm font-black text-white">{prefData.displayName}</h4>
                <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold">
                  {getModeLabel(activeMatchMode)}
                </span>
              </div>

              {prefData.university && (
                <div className="text-xs text-stone-300 font-semibold flex items-center gap-1">
                  🎓 {prefData.university}
                </div>
              )}

              {/* Active preference chips */}
              <div className="flex flex-wrap gap-1.5 mt-1 border-t border-white/5 pt-2">
                {prefData.country && <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">🌍 {prefData.country}</span>}
                {prefData.city && <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">📍 {prefData.city}</span>}
                {prefData.interests.slice(0, 2).map((item: string) => (
                  <span key={item} className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">#{item}</span>
                ))}
              </div>

              {onOpenPreferences && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPreferences();
                  }}
                  className="mt-1 text-center text-[10px] py-1.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 text-amber-400 font-extrabold rounded-xl transition-all animate-fade-in"
                >
                  ✏️ Edit Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Searching Panel */}
      <div className="relative z-10 text-center flex flex-col items-center max-w-sm w-full mt-24 animate-fade-in">
        {status === 'PARTNER_LEFT' ? (
          /* Partner Left State */
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-24 h-24 rounded-full border border-red-500/25 bg-red-500/5 flex items-center justify-center relative shadow-2xl mb-8">
              <span className="text-3xl animate-bounce">👋</span>
            </div>
            <p className="text-red-400 font-extrabold text-lg tracking-tight mb-2">
              {partnerProfile?.displayName || 'Partner'} left.
            </p>
            <p className="text-stone-400 text-xs font-semibold tracking-wide">
              Finding another person...
            </p>
          </div>
        ) : isQueuePaused ? (
          /* Paused State */
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-24 h-24 rounded-full border border-amber-500/20 bg-amber-500/5 flex items-center justify-center relative shadow-2xl mb-8">
              <span className="text-3xl">⏸️</span>
            </div>
            <p className="text-amber-500 font-extrabold text-lg tracking-tight mb-2">
              Matchmaking Paused
            </p>
            <p className="text-stone-400 text-xs font-semibold tracking-wide">
              Save preferences to resume matching...
            </p>
          </div>
        ) : (
          /* Standard Searching State */
          <>
            {/* Apple/Nothing Radar Pulse (Visually changes color per stage) */}
            <div className="relative mb-8 animate-fade-in">
              <div className={`absolute inset-0 rounded-full border ${colors.ping} animate-ping`} style={{ animationDuration: '3s' }} />
              <div className="w-24 h-24 rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center relative shadow-2xl glass">
                <div className={`absolute w-16 h-16 rounded-full border ${colors.border} ${colors.bg} animate-pulse`} />
                <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.text} font-bold text-lg animate-spin`} style={{ animationDuration: '8s' }}>
                  ✦
                </div>
              </div>
            </div>

            {/* Interactive Matching animation digits / words */}
            <p className="text-stone-100 font-extrabold text-lg tracking-tight mb-1 h-7 overflow-hidden transition-all duration-300">
              {currentStageText}
            </p>

            {/* Queue statistics row */}
            <div className="flex items-center justify-center gap-3 mt-4 text-[10px] text-stone-500 font-semibold uppercase tracking-wider border-t border-white/5 pt-4 w-full max-w-[280px]">
              <div>Online: <span className="text-stone-300 font-bold font-mono">{stats.online}</span></div>
              <div className="w-1 h-1 rounded-full bg-stone-700" />
              <div>Queue: <span className="text-stone-300 font-bold font-mono">{stats.searching}</span></div>
              <div className="w-1 h-1 rounded-full bg-stone-700" />
              <div>Wait: <span className="text-stone-300 font-bold font-mono">{stats.wait}s</span></div>
            </div>

            {/* Strict countdown / expand search suggest */}
            {activeMatchMode === 'STRICT' && elapsed >= 15 && (
              <div className="mt-8 p-5 rounded-2xl border border-purple-500/20 bg-purple-950/20 backdrop-blur-xl animate-fade-in text-center flex flex-col items-center w-full">
                <div className="text-xs text-purple-300 font-extrabold mb-1">
                  ⏱️ SEARCH TIME: {formatTimer(elapsed)}
                </div>
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">Still searching...</h4>
                <p className="text-[11px] text-stone-300 leading-relaxed max-w-[280px] mb-3.5">
                  Exact match not found yet. You can keep waiting or expand your search to Smart Match.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setElapsed(0)}
                    className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[10px] font-semibold text-white/70 hover:text-white"
                  >
                    Continue Waiting
                  </button>
                  {onDisableStrict && (
                    <button
                      type="button"
                      onClick={onDisableStrict}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-[10px] font-bold text-white shadow-md shadow-purple-600/20"
                    >
                      Expand Search
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Long wait time invite suggest (elapsed >= 30 seconds) */}
            {elapsed >= 30 && (
              <div className="mt-6 p-4 rounded-xl border border-white/5 bg-white/[0.01] animate-fade-in text-center flex flex-col items-center animate-fade-in">
                <p className="text-[11px] text-stone-400 leading-relaxed max-w-[260px]">
                  No compatible users yet. Invite friends to Kaboom TV or keep searching!
                </p>
              </div>
            )}

            {/* Nothing Phone dot-jump loader */}
            <div className="flex items-center justify-center gap-1.5 pt-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>

            {/* I'm still here check (elapsed >= 300 seconds) */}
            {elapsed >= 300 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-md z-[60] p-6 text-center animate-fade-in pointer-events-auto">
                <div className="max-w-xs w-full bg-stone-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
                  <div className="space-y-2 animate-spring-in">
                    <div className="w-12 h-12 rounded-full border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-xl mx-auto">
                      👋
                    </div>
                    <h3 className="text-lg font-bold text-white">Still looking?</h3>
                    <p className="text-xs text-stone-400">
                      You've been in the queue for a while. Do you want to keep searching?
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setElapsed(0)}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs transition-all active:scale-95"
                    >
                      Keep Searching
                    </button>
                    <button
                      onClick={() => {
                        if (onLeaveQueue) {
                          onLeaveQueue();
                        } else {
                          window.location.href = '/';
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-all active:scale-95"
                    >
                      Leave Queue
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
