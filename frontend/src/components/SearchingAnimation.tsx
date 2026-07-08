import { useEffect, useState, useRef } from 'react';

interface SearchingAnimationProps {
  queuePosition?: number;
}

const WAITING_MESSAGES = [
  "🌍 Searching globally...",
  "🔥 Thousands of people use Kaboom every day.",
  "💜 Your next conversation could start any second.",
  "😊 Stay here. New people join every moment.",
  "✨ Preparing the fastest match...",
  "🚀 Finding someone with the best connection...",
  "🎉 Most users match within a few seconds.",
  "☕ Grab a coffee. We're searching."
];

export function SearchingAnimation({ queuePosition }: SearchingAnimationProps) {
  const [statusText, setStatusText] = useState(WAITING_MESSAGES[0]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Status message rotation - every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusText((prev) => {
        const remaining = WAITING_MESSAGES.filter(m => m !== prev);
        const index = Math.floor(Math.random() * remaining.length);
        return remaining[index];
      });
    }, 5000);
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

    // Particle class with node characteristics
    class Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      fadeSpeed: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2.5 + 1.0;
        this.speedY = (Math.random() * 0.4 - 0.2);
        this.speedX = (Math.random() * 0.4 - 0.2);
        this.opacity = Math.random() * 0.6 + 0.2;
        this.fadeSpeed = Math.random() * 0.001 + 0.0005;
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;

        // Bounce off bounds
        if (this.x < 0 || this.x > width) this.speedX *= -1;
        if (this.y < 0 || this.y > height) this.speedY *= -1;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${this.opacity})`; // Warm amber particles
        ctx.fill();
      }
    }

    const particlesArray: Particle[] = Array.from({ length: 40 }).map(() => new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Render breathing ambient glows
      const time = Date.now() * 0.001;
      const glowX = width / 2 + Math.sin(time) * 100;
      const glowY = height / 2.5 + Math.cos(time * 0.8) * 80;

      const gradient = ctx.createRadialGradient(glowX, glowY, 50, glowX, glowY, 400);
      gradient.addColorStop(0, 'rgba(255, 91, 53, 0.05)'); // Soft Sunset Orange
      gradient.addColorStop(0.5, 'rgba(245, 166, 35, 0.03)'); // Warm Gold
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw connection links between close nodes (glowing network lines)
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

      // Update and draw particles
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

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-stone-950">
      {/* Background Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Main Searching Panel */}
      <div className="relative z-10 text-center flex flex-col items-center max-w-sm px-6">
        {/* Apple/Nothing Radar Pulse */}
        <div className="relative mb-12 animate-fade-in">
          {/* Outermost breathing boundary */}
          <div className="absolute inset-0 rounded-full border border-amber-500/10 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="w-24 h-24 rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center relative shadow-2xl glass">
            {/* Middle pulse */}
            <div className="absolute w-16 h-16 rounded-full border border-amber-500/20 bg-amber-500/[0.02] animate-pulse" />
            {/* Core icon */}
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg animate-spin" style={{ animationDuration: '8s' }}>
              ✦
            </div>
          </div>
        </div>

        {/* Cinematic Text Block */}
        <p className="text-stone-100 font-extrabold text-lg tracking-tight mb-2 h-7 overflow-hidden transition-all duration-300">
          {statusText}
        </p>

        {queuePosition !== undefined && queuePosition > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] text-[10px] font-semibold tracking-wider text-stone-500 uppercase shadow-inner mt-2">
            <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
            Queue Position: {queuePosition}
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
      </div>
    </div>
  );
}
