

import { useState, useEffect, useRef } from 'react';
// Mascot SVG Component - "Kaboomey" (stylized speech bubble comet)
export function KaboomeyMascot({ className = "w-full h-full" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Comet Tail */}
      <path d="M72 45 C 88 28, 92 12, 92 8 C 76 10, 60 20, 48 24" stroke="url(#mascotTailGrad)" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
      {/* Speech Bubble Body */}
      <rect x="12" y="16" width="56" height="46" rx="23" fill="url(#mascotBubbleGrad)" stroke="#F5A623" strokeWidth="2.5" />
      <path d="M30 61 L 18 70 L 22 58" fill="url(#mascotBubbleGrad)" stroke="#F5A623" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Face details */}
      <path d="M26 36 Q 30 31 34 36" stroke="#1E2022" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 36 Q 50 31 54 36" stroke="#1E2022" strokeWidth="3" strokeLinecap="round" />
      {/* Blushing cheeks */}
      <circle cx="23" cy="42" r="3.5" fill="#FF5B35" opacity="0.6" />
      <circle cx="57" cy="42" r="3.5" fill="#FF5B35" opacity="0.6" />
      {/* Cheerful wide-open mouth */}
      <path d="M37 43 Q 40 48 43 43" stroke="#1E2022" strokeWidth="2.5" strokeLinecap="round" />
      
      <defs>
        <linearGradient id="mascotBubbleGrad" x1="12" y1="16" x2="68" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFF4DB" />
        </linearGradient>
        <linearGradient id="mascotTailGrad" x1="48" y1="24" x2="92" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Smooth GPU-accelerated rolling digit counter
export function RollingCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 1200;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress * (2 - progress);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, displayValue]);

  return <span className="font-mono tracking-tight font-black text-amber-600">{displayValue.toLocaleString()}</span>;
}

// ── HIGH FIDELITY WARM LIGHT ROTATING GLOBE ──
export function CinematicGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    const points: Array<{ x: number; y: number; z: number }> = [];
    const numPoints = 260;
    const radius = Math.min(width, height) * 0.38;

    for (let i = 0; i < numPoints; i++) {
      const theta = Math.acos(-1 + (2 * i) / numPoints);
      const phi = Math.sqrt(numPoints * Math.PI) * theta;

      points.push({
        x: radius * Math.sin(theta) * Math.cos(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(theta),
      });
    }

    const arcs: Array<{ startIdx: number; endIdx: number; progress: number; speed: number; active: boolean }> = [];
    for (let i = 0; i < 6; i++) {
      arcs.push({
        startIdx: Math.floor(Math.random() * points.length),
        endIdx: Math.floor(Math.random() * points.length),
        progress: 0,
        speed: 0.006 + Math.random() * 0.008,
        active: Math.random() > 0.3,
      });
    }

    let angleY = 0;
    let angleX = 0.25;

    const project = (x: number, y: number, z: number) => {
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      let x1 = x * cosY - z * sinY;
      let z1 = x * sinY + z * cosY;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      let y2 = y * cosX - z1 * sinX;
      let z2 = y * sinX + z1 * cosX;

      const fov = 400;
      const scale = fov / (fov + z2);
      return {
        x: width / 2 + x1 * scale,
        y: height / 2 + y2 * scale,
        visible: z2 > -80,
        scale,
      };
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      angleY += 0.0012;

      ctx.strokeStyle = 'rgba(245, 166, 35, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      ctx.stroke();

      points.forEach((p) => {
        const proj = project(p.x, p.y, p.z);
        if (proj.visible) {
          ctx.fillStyle = `rgba(245, 166, 35, ${0.16 + (proj.scale - 0.7) * 0.4})`;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 1.3 * proj.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      arcs.forEach((arc) => {
        if (!arc.active) {
          if (Math.random() < 0.006) {
            arc.startIdx = Math.floor(Math.random() * points.length);
            arc.endIdx = Math.floor(Math.random() * points.length);
            arc.progress = 0;
            arc.active = true;
          }
          return;
        }

        arc.progress += arc.speed;
        if (arc.progress >= 1) {
          arc.active = false;
          arc.progress = 0;
          return;
        }

        const pStart = points[arc.startIdx];
        const pEnd = points[arc.endIdx];

        const startProj = project(pStart.x, pStart.y, pStart.z);
        const endProj = project(pEnd.x, pEnd.y, pEnd.z);

        if (startProj.visible && endProj.visible) {
          const midX = (startProj.x + endProj.x) / 2;
          const midY = (startProj.y + endProj.y) / 2 - 35;

          ctx.strokeStyle = 'rgba(255, 91, 53, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startProj.x, startProj.y);
          ctx.quadraticCurveTo(midX, midY, endProj.x, endProj.y);
          ctx.stroke();

          const t = arc.progress;
          const pulseX = (1 - t) * (1 - t) * startProj.x + 2 * (1 - t) * t * midX + t * t * endProj.x;
          const pulseY = (1 - t) * (1 - t) * startProj.y + 2 * (1 - t) * t * midY + t * t * endProj.y;

          ctx.fillStyle = 'rgba(255, 91, 53, 0.85)';
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 91, 53, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}

// ── FLOATING MASCOT COMET BUBBLES ──
export function FloatingAvatar({ index }: { index: number }) {
  const positions = [
    { top: '16%', left: '7%', size: 'w-20 h-20 sm:w-24 sm:h-24', delay: '0s' },
    { top: '24%', right: '9%', size: 'w-22 h-22 sm:w-26 sm:h-26', delay: '1.4s' },
    { bottom: '26%', left: '10%', size: 'w-24 h-24 sm:w-28 sm:h-28', delay: '0.7s' },
    { bottom: '16%', right: '12%', size: 'w-18 h-18 sm:w-22 sm:h-22', delay: '2.1s' },
  ];

  const pos = positions[index % positions.length];

  return (
    <div
      className={`absolute hidden md:flex items-center justify-center rounded-2xl border border-white bg-white/45 backdrop-blur-md pointer-events-none select-none animate-float shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(245,166,35,0.12)] transition-shadow duration-500`}
      style={{
        ...pos,
        animationDelay: pos.delay,
        zIndex: 5,
      }}
    >
      <div className="w-[88%] h-[88%] rounded-2xl bg-stone-100/30 flex items-center justify-center border border-amber-500/10 overflow-hidden relative shadow-inner animate-mascot-wave">
        <KaboomeyMascot className="w-[85%] h-[85%]" />
        <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-500/90 border-2 border-white shadow animate-pulse" />
      </div>
    </div>
  );
}

// ── LIVE MATCH ACTIVITY TICKER ──
const TICKER_ITEMS = [
  { text: '1,842 people online', icon: '🌍' },
  { text: 'Someone connected in Tokyo', icon: '🇯🇵' },
  { text: '36 new matches this minute', icon: '❤️' },
  { text: 'Paris matching now', icon: '🇫🇷' },
  { text: 'Brazil joined queue', icon: '🇧🇷' },
  { text: 'Hyderabad matched', icon: '🇮🇳' },
  { text: 'New York stream active', icon: '🇺🇸' },
  { text: 'London connected', icon: '🇬🇧' },
  { text: 'Sydney matched P2P', icon: '🇦🇺' },
];

export function LiveActivityRibbon() {
  const [items, setItems] = useState(TICKER_ITEMS);

  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => {
        const next = [...prev];
        const last = next.pop();
        if (last) next.unshift(last);
        return next;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full border-y border-white bg-white/35 backdrop-blur-md py-4.5 overflow-hidden relative z-10 select-none shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
      <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-[#FAF9F7] to-transparent z-20 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-[#FAF9F7] to-transparent z-20 pointer-events-none" />

      <div className="flex gap-16 whitespace-nowrap animate-ticker scrollbar-none">
        {Array.from({ length: 3 }).map((_, loopIdx) => (
          <div key={loopIdx} className="flex gap-16 items-center shrink-0">
            {items.map((item, idx) => (
              <div key={`${loopIdx}-${idx}`} className="flex items-center gap-2.5 text-xs font-bold tracking-wider uppercase text-stone-500 font-mono">
                <span className="text-sm">{item.icon}</span>
                <span>{item.text}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/40 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── INTERACTIVE FAKE DEMO LOOP ──
export function InteractiveDemo() {
  const [demoState, setDemoState] = useState<'idle' | 'searching' | 'matched' | 'react' | 'chat'>('idle');

  useEffect(() => {
    const steps: Array<'idle' | 'searching' | 'matched' | 'react' | 'chat'> = [
      'idle',
      'searching',
      'matched',
      'react',
      'chat',
    ];
    let idx = 0;

    const interval = setInterval(() => {
      idx = (idx + 1) % steps.length;
      setDemoState(steps[idx]);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card max-w-sm w-full p-6 flex flex-col gap-5 relative overflow-hidden text-left scale-95 sm:scale-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)] border-white/60 bg-white/40">
      <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between border-b border-stone-200/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-bold font-mono tracking-widest text-stone-500 uppercase">Live Simulation</span>
        </div>
        <span className="text-[10px] font-mono text-stone-400">P2P ENCRYPTED</span>
      </div>

      <div className="h-44 rounded-2xl bg-stone-100/50 border border-white relative flex items-center justify-center overflow-hidden shadow-inner">
        {demoState === 'idle' && (
          <div className="text-center animate-fade-in flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-stone-200/40 flex items-center justify-center text-lg shadow-sm">
              ⚡
            </div>
            <p className="text-xs font-bold text-stone-600">One Click to Connect</p>
          </div>
        )}

        {demoState === 'searching' && (
          <div className="text-center animate-fade-in flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border border-amber-500/10 flex items-center justify-center animate-ping relative mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 font-bold">
                ✦
              </div>
            </div>
            <p className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">Looking for partner...</p>
          </div>
        )}

        {demoState === 'matched' && (
          <div className="w-full h-full flex animate-scale-up">
            <div className="flex-1 border-r border-stone-200/40 bg-stone-200/25 flex items-center justify-center text-[10px] text-stone-400 font-bold relative">
              You
              <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="flex-1 bg-stone-200/15 flex items-center justify-center text-[10px] text-stone-500 font-black relative animate-pulse">
              👋 Stranger
              <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        )}

        {demoState === 'react' && (
          <div className="w-full h-full flex relative">
            <div className="flex-1 border-r border-stone-200/40 bg-stone-200/25 flex items-center justify-center text-[10px] text-stone-400 font-bold">
              You
            </div>
            <div className="flex-1 bg-stone-200/15 flex items-center justify-center text-[10px] text-stone-500 font-black relative">
              👋 Stranger
              <span className="absolute bottom-6 right-10 text-3xl animate-bounce">❤️</span>
              <span className="absolute bottom-12 right-14 text-xl animate-ping opacity-60">🔥</span>
            </div>
          </div>
        )}

        {demoState === 'chat' && (
          <div className="w-full h-full flex flex-col justify-end p-3 gap-2 relative">
            <div className="absolute inset-0 flex">
              <div className="flex-1 border-r border-stone-200/30 bg-stone-200/10" />
              <div className="flex-1 bg-stone-200/5" />
            </div>
            <div className="relative z-10 max-w-[70%] bg-amber-500/10 border border-amber-500/20 rounded-2xl rounded-tl-none p-2.5 text-[10px] text-stone-800 font-bold self-start animate-slide-up">
              Hey there! Where are you connecting from?
            </div>
            <div className="relative z-10 max-w-[70%] bg-white border border-stone-200/40 rounded-2xl rounded-tr-none p-2.5 text-[10px] text-stone-700 font-bold self-end animate-slide-up shadow-sm">
              Tokyo! Beautiful morning here. 🇯🇵
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 h-9 rounded-xl border border-stone-200/40 bg-white/40 flex items-center justify-center gap-1.5 text-[10px] font-bold text-stone-500 shadow-sm">
          <span>🎤 Mic On</span>
        </div>
        <div className="flex-1 h-9 rounded-xl border border-stone-200/40 bg-white/40 flex items-center justify-center gap-1.5 text-[10px] font-bold text-stone-500 shadow-sm">
          <span>🎥 Cam On</span>
        </div>
        <div className="w-20 h-9 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center text-[11px] font-bold text-amber-700">
          Next ➔
        </div>
      </div>
    </div>
  );
}

export const ROTATING_WORDS = ['CLICK', 'CONVERSATION', 'CONNECTION', 'STRANGER', 'STORY', 'FRIEND'];

export const CURIOSITY_MESSAGES = [
  "✨ Meet someone today",
  "🌎 Talk beyond borders",
  "💬 One click away",
  "🎯 Your next conversation is waiting",
  "🔥 Thousands online now",
  "🌍 Discover someone unexpected",
];

export const FLOATING_EMOJIS_POOL = ['❤️', '🔥', '✨', '🎉', '👋', '🌎', '💫', '💥', '😂', '👍'];

