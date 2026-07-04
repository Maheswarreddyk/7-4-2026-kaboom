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
      // Ease out quad
      const ease = progress * (2 - progress);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span className="font-mono tracking-tight font-extrabold text-amber-100">{displayValue.toLocaleString()}</span>;
}

export function LandingPage() {
  const navigate = useNavigate();
  const { isLoading, startSession } = useSession();
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);

  // Seeded organic random metrics
  const [onlineCount, setOnlineCount] = useState(1642);
  const [waitingCount, setWaitingCount] = useState(74);
  const [countriesCount, setCountriesCount] = useState(34);

  // Parallax tilt effect states
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Seeded random walk updates every 4 seconds
    const interval = setInterval(() => {
      setOnlineCount((prev) => {
        const delta = Math.floor(Math.random() * 19) - 9; // -9 to +9
        return Math.max(1200, Math.min(2500, prev + delta));
      });
      setWaitingCount((prev) => {
        const delta = Math.floor(Math.random() * 7) - 3; // -3 to +3
        return Math.max(40, Math.min(150, prev + delta));
      });
      setCountriesCount((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1 to +1
        return Math.max(25, Math.min(45, prev + delta));
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 10, y: y * -10 }); // Tilt up to 10 degrees
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
    <div className="min-h-screen bg-[#070708] flex flex-col justify-between overflow-x-hidden selection:bg-amber-500/20 select-none">
      {/* ── HERO BANNER SECTION ── */}
      <section 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="flex-1 flex flex-col items-center justify-center px-6 py-20 relative max-w-7xl mx-auto w-full"
      >
        {/* Apple style ambient lighting element - ONLY one glow */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none transition-transform duration-700 ease-out"
          style={{
            transform: `translate(${tilt.x * 20}px, ${tilt.y * -20}px) translate(-50%, -50%)`,
            left: '50%',
            top: '40%'
          }}
        />

        <div 
          className="text-center relative z-10 transition-transform duration-500 ease-out flex flex-col items-center"
          style={{
            transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`
          }}
        >
          {/* Subtle VisionOS Pill Badge */}
          <div className="inline-flex items-center gap-2.5 px-4.5 py-2 rounded-full border border-white/5 bg-white/[0.02] text-[11px] font-semibold tracking-[0.2em] text-stone-400 uppercase mb-8 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Zero Credentials · Peer-to-Peer · Encrypted
          </div>

          {/* Cinematic Large Typography */}
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] text-stone-100 max-w-4xl mb-8">
            MEET THE WORLD
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 filter drop-shadow-md">
              IN ONE CLICK.
            </span>
          </h1>

          <p className="text-stone-400 text-base sm:text-lg max-w-xl leading-relaxed tracking-wide mb-12 font-medium">
            Connect instantly with verified peers across the globe. Handcrafted for performance, privacy, and absolute speed.
          </p>

          {/* Glowing Primary CTA Button with Spring Motion */}
          <div className="relative group">
            {/* The single glowing background element for CTA */}
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 opacity-60 blur-md group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <button
              onClick={handleStartChat}
              disabled={isLoading}
              className="relative btn-primary text-base sm:text-lg px-12 py-4 bg-stone-900 border border-amber-500/30 text-stone-100 font-bold rounded-2xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 flex items-center gap-3"
            >
              <svg className="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Start Connection
            </button>
          </div>
        </div>

        {/* ── Floating Stats Dashboard (visionOS style card layers) ── */}
        <div className="w-full max-w-3xl mt-24 grid grid-cols-3 gap-6 relative z-10 px-4">
          {[
            { label: 'Active Conversations', value: onlineCount },
            { label: 'People Waiting', value: waitingCount },
            { label: 'Countries Online', value: countriesCount },
          ].map((stat) => (
            <div 
              key={stat.label} 
              className="relative rounded-2xl border border-white/5 bg-white/[0.01] p-5 shadow-2xl backdrop-blur-md overflow-hidden group hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300"
            >
              <p className="text-3xl sm:text-4xl font-extrabold text-stone-100 tracking-tight">
                <RollingCounter value={stat.value} />
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500 mt-2 leading-tight">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Handcrafted Philosophy Feature Highlights ── */}
      <section className="border-t border-white/5 bg-white/[0.01] py-20 px-6 relative z-10">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-10">
          {[
            {
              icon: '🛡️',
              title: 'Absolute Anonymity',
              desc: 'No logs, no cookies, no tracking. We require zero signup credentials. Connection variables are strictly ephemeral.',
            },
            {
              icon: '⚡',
              title: 'Verified Pipeline',
              desc: 'Sub-second peer handshake matchmaking. Skip connections instantly with zero latency overlaps.',
            },
            {
              icon: '💎',
              title: 'OLED Ambient Motion',
              desc: 'Polished for 60fps micro-rewards. Draggable self-views, spring click feedback, and localized haptic triggers.',
            },
          ].map((feature) => (
            <div key={feature.title} className="flex flex-col items-center text-center">
              <div className="text-3xl mb-4 bg-stone-900 border border-white/5 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">{feature.icon}</div>
              <h3 className="text-stone-200 font-bold tracking-wide mb-2 text-base">{feature.title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed font-medium">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
