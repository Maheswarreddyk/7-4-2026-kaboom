import { useEffect, useState, useRef } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { cn } from '../utils/index.js';

interface SearchingAnimationProps {
  status?: string;
  partnerProfile?: any;
  isQueuePaused?: boolean;
}

export function SearchingAnimation({
  status,
  partnerProfile,
  isQueuePaused
}: SearchingAnimationProps) {
  const { width, height } = useResponsiveLayout();
  const isMinimalLayout = width < 560 || height < 500;

  const activeMatchMode = localStorage.getItem('kaboom_match_mode') || 'RANDOM';
  const university = localStorage.getItem('kaboom_university') || '';

  const [animationStep, setAnimationStep] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Matching stage text rotation (every 1.5 seconds)
  useEffect(() => {
    if (status === 'PARTNER_LEFT' || isQueuePaused) return;
    const interval = setInterval(() => {
      setAnimationStep((prev) => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [status, isQueuePaused]);

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

  return (
    /* 
     * ROOT: Full screen flex column — decoration only.
     * Keeps particles, ambient glows, radar pulses, and rotating match stage texts visible.
     */
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-stone-950 overflow-hidden select-none">
      {/* Background Particle Canvas — purely decorative, lowest priority */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Center status container */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 max-w-sm">
        {status === 'PARTNER_LEFT' ? (
          /* Partner Left State */
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-24 h-24 rounded-full border border-red-500/25 bg-red-500/5 flex items-center justify-center relative shadow-2xl mb-8">
              <span className="text-3xl animate-bounce">👋</span>
            </div>
            <p className="text-red-400 font-extrabold text-lg tracking-tight mb-2">
              {partnerProfile?.displayName || 'Partner'} left.
            </p>
            <p className="text-stone-400 text-xs font-semibold tracking-wide animate-pulse">
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
              Resume matching when you are ready
            </p>
          </div>
        ) : (
          /* Standard Searching State */
          <>
            {/* Apple/Nothing Radar Pulse (Decorative) */}
            <div className={cn("relative animate-fade-in shrink-0", isMinimalLayout ? "mb-2" : "mb-6")}>
              <div className={`absolute inset-0 rounded-full border ${colors.ping} animate-ping`} style={{ animationDuration: '3s' }} />
              <div className={cn("rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center relative shadow-2xl glass", isMinimalLayout ? "w-14 h-14" : "w-20 h-20")}>
                <div className={cn("absolute rounded-full border", colors.border, colors.bg, "animate-pulse", isMinimalLayout ? "w-10 h-10" : "w-14 h-14")} />
                <div className={cn("rounded-xl border flex items-center justify-center font-bold animate-spin", colors.bg, colors.border, colors.text, isMinimalLayout ? "w-6 h-6 text-xs" : "w-8 h-8 text-base")} style={{ animationDuration: '8s' }}>
                  ✦
                </div>
              </div>
            </div>

            {/* Interactive Matching animation text */}
            <p className="text-stone-100 font-extrabold text-sm tracking-tight mb-3 h-6 overflow-hidden transition-all duration-300 shrink-0">
              {currentStageText}
            </p>

            {/* Nothing Phone dot-jump loader */}
            <div className="flex items-center justify-center gap-1.5 shrink-0">
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
