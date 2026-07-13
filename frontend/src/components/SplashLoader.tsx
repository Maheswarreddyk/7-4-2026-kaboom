import { useState, useEffect } from 'react';

const PHRASES = [
  "✨ Preparing your next conversation...",
  "Someone nearby might already be waiting...",
  "Loading your preferences...",
  "Preparing campus network...",
  "Checking nearby users...",
  "Almost ready..."
];

export function SplashLoader() {
  const [visible, setVisible] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    // Only show the splash screen if loading takes more than 150ms
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    
    const interval = setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % PHRASES.length);
    }, 1500); // 1.5 seconds per phrase for readability
    
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505] overflow-hidden">
      {/* Background Animated Gradient / Glow */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
        <div className="w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] bg-gradient-to-tr from-amber-500/20 to-orange-500/10 blur-[100px] rounded-full animate-pulse [animation-duration:4s]" />
      </div>

      {/* Floating Particles Simulation (CSS-based) */}
      <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(ellipse_at_center,_rgba(245,166,35,0.05)_0%,_transparent_70%)]" />

      <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
        {/* Premium Brand Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-0.5 shadow-[0_0_30px_rgba(245,166,35,0.3)]">
            <div className="w-full h-full bg-[#050505] rounded-[10px] flex items-center justify-center">
              <span className="text-2xl animate-pulse [animation-duration:2s]">🔥</span>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white/90">
            KABOOM
          </h1>
        </div>

        {/* Progressive Loading Text */}
        <div className="h-8 flex items-center justify-center overflow-hidden">
          <p 
            key={phraseIdx}
            className="text-sm font-semibold text-amber-500/80 tracking-wide animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            {PHRASES[phraseIdx]}
          </p>
        </div>

        {/* Subtle Pulse Loader (Not a spinner) */}
        <div className="mt-8 flex gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500/40 animate-ping [animation-duration:1.2s]" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-ping [animation-duration:1.2s] [animation-delay:0.2s]" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-ping [animation-duration:1.2s] [animation-delay:0.4s]" />
        </div>
      </div>
    </div>
  );
}
