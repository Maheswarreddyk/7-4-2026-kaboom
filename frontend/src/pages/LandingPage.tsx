import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext.js';
import { useToast } from '../contexts/ToastContext.js';
import { LoadingScreen } from '../components/LoadingScreen.js';

// Smooth GPU-accelerated rolling digit counter
function RollingCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 1200; // 1.2s smooth interpolation
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

  return <span className="font-mono tracking-tight font-extrabold text-amber-500">{displayValue.toLocaleString()}</span>;
}

// ── HIGH FIDELITY 3D POINT CLOUD ROTATING GLOBE ──
function CinematicGlobe() {
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

    // Generate 3D sphere points (latitudes and longitudes)
    const points: Array<{ x: number; y: number; z: number }> = [];
    const numPoints = 280;
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

    // Generate random connection arcs
    const arcs: Array<{ startIdx: number; endIdx: number; progress: number; speed: number; active: boolean }> = [];
    for (let i = 0; i < 6; i++) {
      arcs.push({
        startIdx: Math.floor(Math.random() * points.length),
        endIdx: Math.floor(Math.random() * points.length),
        progress: 0,
        speed: 0.008 + Math.random() * 0.012,
        active: Math.random() > 0.3,
      });
    }

    let angleY = 0;
    let angleX = 0.2; // Slightly tilted toward the user

    const project = (x: number, y: number, z: number) => {
      // Rotate around Y-axis
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      let x1 = x * cosY - z * sinY;
      let z1 = x * sinY + z * cosY;

      // Rotate around X-axis
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      let y2 = y * cosX - z1 * sinX;
      let z2 = y * sinX + z1 * cosX;

      // 3D Perspective Projection
      const fov = 400;
      const scale = fov / (fov + z2);
      return {
        x: width / 2 + x1 * scale,
        y: height / 2 + y2 * scale,
        visible: z2 > -100, // Cull backface points gently
        scale,
      };
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      angleY += 0.0018; // Slow rotation

      // Draw faint grid rings
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.03)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw points
      points.forEach((p) => {
        const proj = project(p.x, p.y, p.z);
        if (proj.visible) {
          ctx.fillStyle = `rgba(245, 166, 35, ${0.1 + (proj.scale - 0.7) * 0.5})`;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 1.2 * proj.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Update & Draw Connection Arcs
      arcs.forEach((arc) => {
        if (!arc.active) {
          if (Math.random() < 0.005) {
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
          // Calculate quadratic bezier control point (arcing outward)
          const midX = (startProj.x + endProj.x) / 2;
          const midY = (startProj.y + endProj.y) / 2 - 40; // Arc height

          // Draw the full thin path
          ctx.strokeStyle = 'rgba(245, 166, 35, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startProj.x, startProj.y);
          ctx.quadraticCurveTo(midX, midY, endProj.x, endProj.y);
          ctx.stroke();

          // Draw the moving pulse along path
          const t = arc.progress;
          const pulseX = (1 - t) * (1 - t) * startProj.x + 2 * (1 - t) * t * midX + t * t * endProj.x;
          const pulseY = (1 - t) * (1 - t) * startProj.y + 2 * (1 - t) * t * midY + t * t * endProj.y;

          ctx.fillStyle = 'rgba(255, 91, 53, 0.85)';
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 2, 0, Math.PI * 2);
          ctx.fill();

          // Pulse glow ring
          ctx.strokeStyle = 'rgba(255, 91, 53, 0.25)';
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

// ── FLOATING SILHOUETTE AVATARS ──
function FloatingAvatar({ index }: { index: number }) {
  // Pre-configured paths for slow floats
  const positions = [
    { top: '15%', left: '8%', size: 'w-14 h-14 sm:w-16 sm:h-16', delay: '0s' },
    { top: '22%', right: '10%', size: 'w-16 h-16 sm:w-20 sm:h-20', delay: '1.2s' },
    { bottom: '25%', left: '12%', size: 'w-20 h-20 sm:w-24 sm:h-24', delay: '0.6s' },
    { bottom: '18%', right: '14%', size: 'w-12 h-12 sm:w-16 sm:h-16', delay: '1.8s' },
  ];

  const pos = positions[index % positions.length];

  return (
    <div
      className={`absolute hidden md:flex items-center justify-center rounded-full border border-white/5 bg-white/[0.01] backdrop-blur-sm pointer-events-none select-none animate-float shadow-xl`}
      style={{
        ...pos,
        animationDelay: pos.delay,
        zIndex: 5,
      }}
    >
      <div className="w-[85%] h-[85%] rounded-full bg-stone-900/60 flex items-center justify-center border border-amber-500/10 overflow-hidden relative">
        {/* Soft Silhouette Avatar */}
        <svg className="w-1/2 h-1/2 text-stone-600/60" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        {/* Glowing green active indicator */}
        <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500/80 border border-stone-900 shadow animate-pulse" />
      </div>
    </div>
  );
}

// ── LIVE MATCH ACTIVITY TICKER ──
const TICKER_ITEMS = [
  { text: '1,842 people online', icon: '🌍', glow: 'text-amber-400' },
  { text: 'Someone connected in Tokyo', icon: '🇯🇵', glow: 'text-stone-300' },
  { text: '36 new matches this minute', icon: '❤️', glow: 'text-red-400' },
  { text: 'Paris matching now', icon: '🇫🇷', glow: 'text-stone-300' },
  { text: 'Brazil joined queue', icon: '🇧🇷', glow: 'text-emerald-400' },
  { text: 'Hyderabad matched', icon: '🇮🇳', glow: 'text-orange-400' },
  { text: 'New York stream active', icon: '🇺🇸', glow: 'text-blue-400' },
  { text: 'London connected', icon: '🇬🇧', glow: 'text-stone-300' },
  { text: 'Sydney matched P2P', icon: '🇦🇺', glow: 'text-yellow-400' },
];

function LiveActivityRibbon() {
  const [items, setItems] = useState(TICKER_ITEMS);

  // Shuffle or rotate array items slowly for variance
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
    <div className="w-full border-y border-white/5 bg-black/40 backdrop-blur-md py-4.5 overflow-hidden relative z-10 select-none">
      {/* Light leaks */}
      <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-black to-transparent z-20 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-black to-transparent z-20 pointer-events-none" />

      {/* Scrolling Track */}
      <div className="flex gap-16 whitespace-nowrap animate-ticker scrollbar-none">
        {Array.from({ length: 3 }).map((_, loopIdx) => (
          <div key={loopIdx} className="flex gap-16 items-center shrink-0">
            {items.map((item, idx) => (
              <div key={`${loopIdx}-${idx}`} className="flex items-center gap-2.5 text-xs font-semibold tracking-wider uppercase text-stone-400 font-mono">
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
function InteractiveDemo() {
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
    <div className="glass-card max-w-sm w-full p-6 flex flex-col gap-5 relative overflow-hidden text-left scale-95 sm:scale-100 shadow-2xl">
      {/* Absolute Glow */}
      <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-bold font-mono tracking-widest text-stone-400 uppercase">Live Simulation</span>
        </div>
        <span className="text-[10px] font-mono text-stone-500">P2P ENCRYPTED</span>
      </div>

      {/* Display Panel */}
      <div className="h-44 rounded-2xl bg-[#030303] border border-white/5 relative flex items-center justify-center overflow-hidden">
        {demoState === 'idle' && (
          <div className="text-center animate-fade-in flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">
              ⚡
            </div>
            <p className="text-xs font-semibold text-stone-400">One Click to Connect</p>
          </div>
        )}

        {demoState === 'searching' && (
          <div className="text-center animate-fade-in flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border border-amber-500/20 flex items-center justify-center animate-ping relative mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold">
                ✦
              </div>
            </div>
            <p className="text-[11px] font-bold tracking-wider text-stone-500 uppercase">Looking for partner...</p>
          </div>
        )}

        {demoState === 'matched' && (
          <div className="w-full h-full flex animate-scale-up">
            <div className="flex-1 border-r border-white/5 bg-stone-900/30 flex items-center justify-center text-[10px] text-stone-500 relative">
              You
              <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="flex-1 bg-stone-900/20 flex items-center justify-center text-[10px] text-stone-400 font-bold relative animate-pulse">
              👋 Stranger
              <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        )}

        {demoState === 'react' && (
          <div className="w-full h-full flex relative">
            <div className="flex-1 border-r border-white/5 bg-stone-900/30 flex items-center justify-center text-[10px] text-stone-500">
              You
            </div>
            <div className="flex-1 bg-stone-900/20 flex items-center justify-center text-[10px] text-stone-400 font-bold relative">
              👋 Stranger
              {/* Floating Heart Burst Simulation */}
              <span className="absolute bottom-6 right-10 text-3xl animate-bounce">❤️</span>
              <span className="absolute bottom-12 right-14 text-xl animate-ping opacity-60">🔥</span>
            </div>
          </div>
        )}

        {demoState === 'chat' && (
          <div className="w-full h-full flex flex-col justify-end p-3 gap-2 relative">
            <div className="absolute inset-0 flex">
              <div className="flex-1 border-r border-white/5 bg-stone-900/20" />
              <div className="flex-1 bg-stone-900/10" />
            </div>
            <div className="relative z-10 max-w-[70%] bg-amber-500/10 border border-amber-500/25 rounded-2xl rounded-tl-none p-2.5 text-[10px] text-stone-200 self-start animate-slide-up">
              Hey there! Where are you connecting from?
            </div>
            <div className="relative z-10 max-w-[70%] bg-stone-900 border border-white/5 rounded-2xl rounded-tr-none p-2.5 text-[10px] text-stone-300 self-end animate-slide-up">
              Tokyo! Beautiful morning here. 🇯🇵
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <div className="flex-1 h-9 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-center gap-1.5 text-[10px] font-bold text-stone-400">
          <span>🎤 Mic On</span>
        </div>
        <div className="flex-1 h-9 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-center gap-1.5 text-[10px] font-bold text-stone-400">
          <span>🎥 Cam On</span>
        </div>
        <div className="w-20 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[11px] font-bold text-amber-400">
          Next ➔
        </div>
      </div>
    </div>
  );
}

// ── DYNAMIC ROTATING WORD LIST ──
const ROTATING_WORDS = ['WORLD', 'STRANGER', 'FRIEND', 'CONNECTION', 'STORY', 'CONVERSATION'];

export function LandingPage() {
  const navigate = useNavigate();
  const { isLoading, startSession } = useSession();
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);

  // Seeded organic random metrics
  const [onlineCount, setOnlineCount] = useState(1842);
  const [waitingCount, setWaitingCount] = useState(86);
  const [countriesCount, setCountriesCount] = useState(42);

  // Dynamic Word Rotation
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [wordFadeState, setWordFadeState] = useState<'in' | 'out'>('in');

  // Parallax tilt effect states
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Dynamic Word Rotation Loop
    const rotationInterval = setInterval(() => {
      setWordFadeState('out');
      setTimeout(() => {
        setCurrentWordIdx((prev) => (prev + 1) % ROTATING_WORDS.length);
        setWordFadeState('in');
      }, 400); // Syncs with transition durations
    }, 4000);

    // Online counters loop updates
    const countInterval = setInterval(() => {
      setOnlineCount((prev) => {
        const delta = Math.floor(Math.random() * 15) - 7;
        return Math.max(1500, Math.min(2600, prev + delta));
      });
      setWaitingCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(60, Math.min(130, prev + delta));
      });
      setCountriesCount((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.max(38, Math.min(50, prev + delta));
      });
    }, 5000);

    return () => {
      clearInterval(rotationInterval);
      clearInterval(countInterval);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 8, y: y * -8 }); // Tilt up to 8 degrees
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleStartChat = async () => {
    setStarting(true);
    try {
      await startSession();
      navigate('/chat');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  if (starting) {
    return <LoadingScreen message="Creating secure anonymous tunnel..." />;
  }

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col justify-between overflow-x-hidden selection:bg-amber-500/20 select-none relative">
      {/* ── STYLE TAG FOR HIGH FIDELITY CORE ANIMATIONS ── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(1.5deg); }
        }
        .animate-float {
          animation: float 7s cubic-bezier(0.445, 0.05, 0.55, 0.95) infinite;
        }
        @keyframes letterReveal {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        .reveal-letter {
          display: inline-block;
          animation: letterReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.3333%); }
        }
        .animate-ticker {
          animation: ticker 28s linear infinite;
        }
        .btn-shine::before {
          content: '';
          position: absolute;
          top: 0; left: -150%;
          width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
          transform: skewX(-20deg);
          transition: 0.75s;
        }
        .btn-shine:hover::before {
          left: 200%;
        }
      `}</style>

      {/* Dynamic Cursor Spotlight Layer */}
      <div
        className="absolute w-[450px] h-[450px] rounded-full bg-amber-500/3 blur-[120px] pointer-events-none transition-all duration-300 ease-out z-0 hidden md:block"
        style={{
          left: `${mousePos.x - 225}px`,
          top: `${mousePos.y - 225}px`,
        }}
      />

      {/* ── HERO BANNER SECTION (FULL VIEWPORT) ── */}
      <section
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="min-h-screen flex flex-col justify-between items-center px-6 pt-24 pb-16 relative w-full z-10"
      >
        {/* Glowing Background Globe Visualization */}
        <div className="absolute inset-0 flex items-center justify-center z-0 overflow-hidden pointer-events-none opacity-85">
          <div className="w-[85vw] h-[85vw] max-w-[650px] max-h-[650px] relative rounded-full">
            <div className="absolute inset-0 rounded-full bg-radial-gradient from-amber-500/5 via-transparent to-transparent blur-3xl" />
            <CinematicGlobe />
          </div>
        </div>

        {/* Ambient background lights */}
        <div className="absolute w-[600px] h-[600px] rounded-full bg-gradient-radial from-amber-500/[0.015] via-transparent to-transparent blur-[140px] pointer-events-none left-1/3 top-1/4" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-radial from-orange-500/[0.012] via-transparent to-transparent blur-[120px] pointer-events-none right-1/4 bottom-1/3" />

        {/* Floating Silhouette Avatars */}
        <FloatingAvatar index={0} />
        <FloatingAvatar index={1} />
        <FloatingAvatar index={2} />
        <FloatingAvatar index={3} />

        {/* Core Content */}
        <div
          className="flex-1 flex flex-col items-center justify-center text-center relative z-10 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] max-w-4xl w-full"
          style={{
            transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
          }}
        >
          {/* Subtle Capsule Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.01] text-[10px] font-semibold tracking-[0.25em] text-stone-400 uppercase mb-8 shadow-inner glass animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Zero Login · Peer-to-Peer · Ephemeral
          </div>

          {/* Cinematic Large Typography with Staggered Word Reveal */}
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight leading-[0.9] text-stone-100 mb-8 max-w-3xl">
            {['YOUR', 'NEXT', 'CONVERSATION', 'STARTS'].map((word, i) => (
              <span
                key={word}
                className="reveal-letter"
                style={{ animationDelay: `${i * 0.12}s`, marginRight: '0.15em' }}
              >
                {word}
              </span>
            ))}
            <br />
            <span className="inline-block relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300">
                WITH A{' '}
              </span>
              {/* Dynamic Morphing Word Container */}
              <span
                className={`inline-block min-w-[200px] text-stone-100 transition-all duration-300 font-extrabold tracking-tight ${
                  wordFadeState === 'in' ? 'opacity-100 translate-y-0 filter blur-0' : 'opacity-0 translate-y-2 filter blur-[4px]'
                }`}
              >
                {ROTATING_WORDS[currentWordIdx]}
              </span>
            </span>
          </h1>

          <p className="text-stone-400 text-sm sm:text-base max-w-md leading-relaxed tracking-wide mb-10 font-medium animate-fade-in" style={{ animationDelay: '0.6s' }}>
            Meet real people instantly. No account bounds, no waiting loops. Connect P2P in one click.
          </p>

          {/* Glowing CTA Button */}
          <div className="relative group animate-fade-in" style={{ animationDelay: '0.7s' }}>
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 opacity-60 blur-md group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <button
              onClick={handleStartChat}
              disabled={isLoading}
              className="relative btn-primary btn-shine text-sm sm:text-base px-10 py-4 bg-stone-900 border border-amber-500/35 text-stone-100 font-bold rounded-full hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 flex items-center gap-3 overflow-hidden"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Start Connection</span>
              <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Floating Mini counters */}
        <div className="w-full max-w-xl grid grid-cols-3 gap-4 relative z-10 px-4 mt-8 animate-fade-in" style={{ animationDelay: '0.8s' }}>
          {[
            { label: 'ONLINE NOW', value: onlineCount },
            { label: 'IN QUEUE', value: waitingCount },
            { label: 'COUNTRIES', value: countriesCount },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-3 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-md glass">
              <span className="text-lg sm:text-2xl font-black text-stone-100 tracking-tight">
                <RollingCounter value={stat.value} />
              </span>
              <span className="block text-[8px] font-bold uppercase tracking-[0.2em] text-stone-500 mt-1">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE ACTIVITY RIBBON ── */}
      <LiveActivityRibbon />

      {/* ── INTERACTIVE FAKE DEMO & PHILOSOPHY SECTIONS ── */}
      <section className="relative w-full py-28 px-6 bg-[#08080a] border-t border-white/5 z-10 flex flex-col items-center">
        {/* Background ambient gold leak */}
        <div className="absolute w-[450px] h-[450px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none -translate-x-1/2 left-1/2 top-1/4" />

        <div className="max-w-6xl w-full grid md:grid-cols-2 gap-16 items-center">
          {/* Text/Philosophy */}
          <div className="flex flex-col items-start text-left max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] text-[9px] font-bold tracking-[0.2em] text-amber-500 uppercase mb-5">
              ✦ Live Simulator
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-stone-100 mb-6">
              ZERO CONFIG.
              <br />
              JUST MATCH.
            </h2>
            <p className="text-stone-400 text-sm leading-relaxed mb-8 font-medium">
              We built Kaboom to strip away the friction of modern web communication. No signup gates, no configuration details. Just pure connections, routed P2P.
            </p>

            {/* Horizontal Story Steps */}
            <div className="flex flex-col gap-5 w-full">
              {[
                { step: '1', title: 'Start session instantly', desc: 'Secure connection variables initialize in memory without databases.' },
                { step: '2', title: 'P2P tunnel handshake', desc: 'We WebRTC-bridge matching peers directly, keeping audio/video off servers.' },
                { step: '3', title: 'Interact or skip', desc: 'Exchange chat messages, likes, reactions, and double-tap swap layouts.' },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 items-start">
                  <div className="w-7 h-7 rounded-lg border border-white/10 bg-stone-900/80 flex items-center justify-center text-[10px] font-black text-amber-500 shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-stone-200 font-bold text-xs uppercase tracking-wider">{item.title}</h4>
                    <p className="text-stone-500 text-xs mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulator Component */}
          <div className="flex justify-center relative">
            <div className="absolute inset-0 bg-radial-gradient from-amber-500/10 via-transparent to-transparent blur-3xl pointer-events-none" />
            <InteractiveDemo />
          </div>
        </div>
      </section>

      {/* ── PREMIUM FEATURE CARDS GRID ── */}
      <section className="w-full py-28 px-6 bg-stone-950 border-t border-white/5 z-10 flex flex-col items-center">
        <div className="max-w-6xl w-full text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] text-[9px] font-bold tracking-[0.2em] text-amber-500 uppercase mb-5">
            ✦ Core Pipeline
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-stone-100 mb-16">
            BUILT FOR SPEED.
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '⚡',
                title: 'Instant Match',
                desc: 'Matching candidates are paired in under 400ms using Supabase Realtime synchronization pools.',
              },
              {
                icon: '🔒',
                title: 'Private Streams',
                desc: 'All streaming data relies entirely on WebRTC connection protocols, keeping streams fully local.',
              },
              {
                icon: '💎',
                title: 'Collectible Design',
                desc: 'Matte dark interface variables inspired by high-end consumer hardware interfaces.',
              },
              {
                icon: '🎥',
                title: 'HD Optimization',
                desc: 'Adaptive video pipelines adjust resolution in real-time based on active packet round-trips.',
              },
              {
                icon: '❤️',
                title: 'Mutual Matching',
                desc: 'Dual-consent matches unlock persistent floating overlay live chats and text message grids.',
              },
              {
                icon: '💬',
                title: 'Live Chat',
                desc: 'Stream-style chat cards overlay seamlessly with auto-dismiss timers to stay clear of streams.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="glass-card flex flex-col items-start text-left p-8 group hover:scale-[1.01] hover:border-amber-500/25 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-stone-900 border border-white/5 flex items-center justify-center text-lg mb-6 group-hover:border-amber-500/25 group-hover:bg-amber-500/5 transition-all">
                  {card.icon}
                </div>
                <h3 className="text-stone-100 font-extrabold tracking-tight mb-2 text-sm uppercase">
                  {card.title}
                </h3>
                <p className="text-stone-500 text-xs leading-relaxed font-medium">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MINI PHILOSOPHY LOOP ROADMAP ── */}
      <section className="relative w-full py-28 px-6 bg-[#08080a] border-t border-white/5 z-10 flex flex-col items-center">
        <div className="max-w-4xl w-full text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-2xl mb-8 animate-pulse">
            💫
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-stone-100 max-w-lg mb-6 leading-none">
            YOUR NEXT
            <br />
            STORY AWAITS.
          </h2>
          <p className="text-stone-400 text-sm max-w-sm leading-relaxed mb-10 font-medium">
            Join thousands of active peers connecting right now. Zero signup loops, zero trackers. Just matches.
          </p>

          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 opacity-60 blur-md group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <button
              onClick={handleStartChat}
              disabled={isLoading}
              className="relative btn-primary btn-shine text-sm px-8 py-3.5 bg-stone-900 border border-amber-500/35 text-stone-100 font-bold rounded-full hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 flex items-center gap-2"
            >
              <span>Match Instantly</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
