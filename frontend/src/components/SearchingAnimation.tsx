import { useEffect, useState, useRef } from 'react';

interface SearchingAnimationProps {
  queuePosition?: number;
  matchMode?: string;
  onDisableStrict?: () => void;
  onOpenPreferences?: () => void;
  status?: string;
  partnerProfile?: any;
  isQueuePaused?: boolean;
}

export function SearchingAnimation({
  matchMode,
  onDisableStrict,
  onOpenPreferences,
  status,
  partnerProfile,
  isQueuePaused
}: SearchingAnimationProps) {
  const [elapsed, setElapsed] = useState(0);
  const [animationStep, setAnimationStep] = useState(0);
  const [stats, setStats] = useState({ online: 127, searching: 41, wait: 8 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Extract preferences from localStorage for the "Searching As" card
  const displayName = localStorage.getItem('kaboom_display_name') || 'Guest';
  const country = localStorage.getItem('kaboom_country') || '';
  const city = localStorage.getItem('kaboom_city') || '';
  const university = localStorage.getItem('kaboom_university') || '';
  let interests: string[] = [];
  try {
    interests = JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]');
  } catch {}

  const activeMatchMode = matchMode || localStorage.getItem('kaboom_match_mode') || 'RANDOM';

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

  // Build the matching stages sequence dynamically
  const matchingStages = [
    `👤 ${displayName}`,
    "🔍 Searching...",
    country ? `🌍 ${country}` : "🌍 Worldwide",
    "⚡ Finding someone...",
    university ? `🎓 ${university}` : "🏫 Campus Network",
    interests.length > 0 ? `✨ ${interests[0]}` : "💬 Friendly Chat",
    "🔒 Checking compatibility...",
    "🤝 Found Candidate!"
  ];
  const currentStageText = matchingStages[animationStep % matchingStages.length];

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

      {/* Top Section: "Searching As" summary card */}
      {status !== 'PARTNER_LEFT' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white/[0.02] border border-white/10 rounded-2xl p-4 backdrop-blur-xl z-20 shadow-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Searching As</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Queue Active</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white">{displayName}</h4>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold">
              {getModeLabel(activeMatchMode)}
            </span>
          </div>

          {/* Active preference chips */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {country && <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">🌍 {country}</span>}
            {city && <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">📍 {city}</span>}
            {university && <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-stone-300 border border-white/5 font-semibold">🎓 {university}</span>}
            {interests.slice(0, 2).map((item) => (
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

      {/* Main Searching Panel */}
      <div className="relative z-10 text-center flex flex-col items-center max-w-sm w-full mt-24">
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
            {/* Apple/Nothing Radar Pulse */}
            <div className="relative mb-8 animate-fade-in">
              <div className="absolute inset-0 rounded-full border border-amber-500/10 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="w-24 h-24 rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center relative shadow-2xl glass">
                <div className="absolute w-16 h-16 rounded-full border border-amber-500/20 bg-amber-500/[0.02] animate-pulse" />
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg animate-spin" style={{ animationDuration: '8s' }}>
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
              <div className="mt-6 p-4 rounded-xl border border-white/5 bg-white/[0.01] animate-fade-in text-center flex flex-col items-center">
                <p className="text-[11px] text-stone-400 leading-relaxed max-w-[260px]">
                  No compatible users yet. Invite friends to Kaboom or keep searching!
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
          </>
        )}
      </div>
    </div>
  );
}
