import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext.js';
import { useToast } from '../contexts/ToastContext.js';
import { LoadingScreen } from '../components/LoadingScreen.js';
import { MetaManager } from '../components/MetaManager.js';
import { PreferenceModal } from '../components/PreferenceModal.js';
import { apiService } from '../services/api.js';
import { cn } from '../utils/index.js';

// Mascot SVG Component - "Kaboomey" (stylized speech bubble comet)
function KaboomeyMascot({ className = "w-full h-full" }: { className?: string }) {
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
function RollingCounter({ value }: { value: number }) {
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
function FloatingAvatar({ index }: { index: number }) {
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

function LiveActivityRibbon() {
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

const ROTATING_WORDS = ['CLICK', 'CONVERSATION', 'CONNECTION', 'STRANGER', 'STORY', 'FRIEND'];

const CURIOSITY_MESSAGES = [
  "✨ Meet someone today",
  "🌎 Talk beyond borders",
  "💬 One click away",
  "🎯 Your next conversation is waiting",
  "🔥 Thousands online now",
  "🌍 Discover someone unexpected",
];

const FLOATING_EMOJIS_POOL = ['❤️', '🔥', '✨', '🎉', '👋', '🌎', '💫', '💥', '😂', '👍'];

export function LandingPage() {
  const navigate = useNavigate();
  const { session, isLoading, startSession } = useSession();
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<string>('RANDOM');
  const [languagesDetail, setLanguagesDetail] = useState<string>('');
  const [showResumeCard, setShowResumeCard] = useState(false);
  const [curiosityIdx, setCuriosityIdx] = useState(0);
  const [curiosityFadeState, setCuriosityFadeState] = useState<'in' | 'out'>('in');
  const [magneticOffset, setMagneticOffset] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const getSavedPreferences = () => {
    try {
      return {
        display_name: localStorage.getItem('kaboom_display_name') || '',
        bio: localStorage.getItem('kaboom_bio') || '',
        university: localStorage.getItem('kaboom_university') || '',
        match_mode: localStorage.getItem('kaboom_match_mode') || 'RANDOM',
        match_constraints: JSON.parse(localStorage.getItem('kaboom_match_constraints') || '{}'),
        languages: JSON.parse(localStorage.getItem('kaboom_languages') || '["English"]'),
        country: localStorage.getItem('kaboom_country') || '',
        state: localStorage.getItem('kaboom_state') || '',
        district: localStorage.getItem('kaboom_district') || '',
        city: localStorage.getItem('kaboom_city') || '',
        gender: localStorage.getItem('kaboom_gender') || 'Prefer not to say',
        looking_for: JSON.parse(localStorage.getItem('kaboom_looking_for') || '["Anyone"]'),
        interest_tags: JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]'),
      };
    } catch {
      return {};
    }
  };

  useEffect(() => {
    const name = localStorage.getItem('kaboom_display_name');
    if (name) {
      setDisplayName(name);
      setMatchMode(localStorage.getItem('kaboom_match_mode') || 'RANDOM');
      try {
        const langs = JSON.parse(localStorage.getItem('kaboom_languages') || '[]');
        if (langs.length > 0) {
          setLanguagesDetail(langs.join(', '));
        } else {
          setLanguagesDetail('English');
        }
      } catch {
        setLanguagesDetail('English');
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowResumeCard(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // V4.1 Auto-Restoration Redirect (Requirement 6 & 17)
  useEffect(() => {
    if (!isLoading && session) {
      const activeStates = ['SEARCHING', 'RESERVED', 'MATCHED', 'SIGNALING', 'CONNECTED', 'REQUEUEING', 'waiting', 'matched'];
      if (session.status && activeStates.includes(session.status)) {
        console.log(`[Auto-Restore] Active session status detected: ${session.status}. Redirecting to /chat...`);
        navigate('/chat');
      }
    }
  }, [session, isLoading, navigate]);

  const [onlineCount, setOnlineCount] = useState(1842);
  const [waitingCount, setWaitingCount] = useState(86);
  const [countriesCount, setCountriesCount] = useState(42);

  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [wordFadeState, setWordFadeState] = useState<'in' | 'out'>('in');

  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // V6 Emoji Personality State (continuous slow upward floats)
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: number; emoji: string; left: number; delay: number }>>([]);
  // Click burst particles
  const [clickParticles, setClickParticles] = useState<Array<{ id: number; emoji?: string; x: number; y: number; scale: number; active: boolean }>>([]);
  const [isExploded, setIsExploded] = useState(false);

  // Dynamic Story notifications state
  const [storyNotification, setStoryNotification] = useState<{ text: string; side: 'left' | 'right' } | null>(null);

  // Dynamic story pools
  const STORY_NOTIFS = [
    { text: "Someone connected in Osaka 🇯🇵", side: 'left' as const },
    { text: "New P2P match established ✨", side: 'right' as const },
    { text: "Strangers are waving hello 👋", side: 'left' as const },
    { text: "Mutual match made in Paris ❤️", side: 'right' as const },
    { text: "Someone liked a partner stream 🔥", side: 'left' as const },
  ];

  useEffect(() => {
    // Rotation for Header Word Morph
    const rotationInterval = setInterval(() => {
      setWordFadeState('out');
      setTimeout(() => {
        setCurrentWordIdx((prev) => (prev + 1) % ROTATING_WORDS.length);
        setWordFadeState('in');
      }, 400);
    }, 4000);

    // Curiosity text rotator
    const curiosityInterval = setInterval(() => {
      setCuriosityFadeState('out');
      setTimeout(() => {
        setCuriosityIdx((prev) => (prev + 1) % CURIOSITY_MESSAGES.length);
        setCuriosityFadeState('in');
      }, 300);
    }, 5000);

    // Continuous floating emojis (Emoji Personality)
    const emojiInterval = setInterval(() => {
      const id = Math.random();
      const newEmoji = {
        id,
        emoji: FLOATING_EMOJIS_POOL[Math.floor(Math.random() * FLOATING_EMOJIS_POOL.length)],
        left: 20 + Math.random() * 60,
        delay: 0,
      };
      setFloatingEmojis((prev) => [...prev, newEmoji]);
      setTimeout(() => {
        setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
      }, 3500);
    }, 1800);

    // Dynamic Story bubble notifications
    const storyInterval = setInterval(() => {
      const item = STORY_NOTIFS[Math.floor(Math.random() * STORY_NOTIFS.length)];
      setStoryNotification(item);
      setTimeout(() => setStoryNotification(null), 3500);
    }, 7000);

    // Metrics updates
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
      clearInterval(curiosityInterval);
      clearInterval(emojiInterval);
      clearInterval(storyInterval);
      clearInterval(countInterval);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 6, y: y * -6 });
    setMousePos({ x: e.clientX, y: e.clientY });

    // Magnetic cursor pull on the primary button
    if (buttonRef.current) {
      const btnRect = buttonRef.current.getBoundingClientRect();
      const btnCenterX = btnRect.left + btnRect.width / 2;
      const btnCenterY = btnRect.top + btnRect.height / 2;
      
      const dx = e.clientX - btnCenterX;
      const dy = e.clientY - btnCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 140) {
        // Gently pull 2-4px towards pointer (responsive interaction)
        const pullFactor = 0.035;
        setMagneticOffset({
          x: dx * pullFactor,
          y: dy * pullFactor,
        });
      } else {
        setMagneticOffset({ x: 0, y: 0 });
      }
    }
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setMagneticOffset({ x: 0, y: 0 });
  };

  const triggerClickExplosion = () => {
    // Generate particle positions
    const particles = Array.from({ length: 32 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 110;
      const isEmoji = Math.random() > 0.6;
      return {
        id: Math.random() + i,
        emoji: isEmoji ? FLOATING_EMOJIS_POOL[Math.floor(Math.random() * FLOATING_EMOJIS_POOL.length)] : undefined,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        scale: 0.5 + Math.random() * 0.8,
        active: false,
      };
    });

    setClickParticles(particles);
    setIsExploded(true);

    // Trigger transform update in next frame
    setTimeout(() => {
      setClickParticles((prev) => prev.map((p) => ({ ...p, active: true })));
    }, 20);

    setTimeout(() => {
      setClickParticles([]);
      setIsExploded(false);
    }, 1500);
  };

  const handleStartNewConversation = async () => {
    triggerClickExplosion();
    await new Promise((resolve) => setTimeout(resolve, 600));

    const tutorialSeen = localStorage.getItem('kaboom_tutorial_seen') === 'true';
    if (!tutorialSeen) {
      setShowTutorial(true);
    } else {
      setShowPreferenceModal(true);
    }
  };

  const handleResumeSetup = async () => {
    triggerClickExplosion();
    await new Promise((resolve) => setTimeout(resolve, 600));

    setStarting(true);
    try {
      await startSession();
      navigate('/chat');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to start session');
      setStarting(false);
    }
  };

  if (starting) {
    return <LoadingScreen message="Creating secure anonymous tunnel..." />;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col justify-between overflow-x-hidden selection:bg-amber-500/20 select-none relative text-stone-800">
      <MetaManager page="home" />
      
      {/* ── STYLE TAG FOR V6 CORE MASCOT & GAME CONTROLS KEYFRAMES ── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1.2deg); }
        }
        .animate-float {
          animation: float 8s cubic-bezier(0.445, 0.05, 0.55, 0.95) infinite;
        }
        @keyframes letterReveal {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.97);
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
          animation: letterReveal 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.3333%); }
        }
        .animate-ticker {
          animation: ticker 28s linear infinite;
        }
        
        /* Game button shine reflection */
        .btn-shine::before {
          content: '';
          position: absolute;
          top: 0; left: -150%;
          width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
          transform: skewX(-20deg);
          transition: 0.85s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .btn-shine:hover::before {
          left: 200%;
        }

        /* Slow breathing background auroras */
        @keyframes auroraBreath {
          0%, 100% { transform: translate(-30%, -20%) scale(1); opacity: 0.4; }
          50% { transform: translate(-25%, -25%) scale(1.1); opacity: 0.65; }
        }
        .animate-aurora {
          animation: auroraBreath 22s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }

        /* Glassmorphism system card designs */
        .glass-card {
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(24px) saturate(110%);
          -webkit-backdrop-filter: blur(24px) saturate(110%);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 
            0 12px 36px -10px rgba(0, 0, 0, 0.03),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
        }
        .glass-card:hover {
          background: rgba(255, 255, 255, 0.65);
          border-color: rgba(255, 255, 255, 0.8);
          box-shadow: 
            0 20px 48px -8px rgba(0, 0, 0, 0.05),
            0 0 24px 0 rgba(245, 166, 35, 0.08);
        }

        /* Upward emoji floats */
        @keyframes emojiFloatUp {
          0% { transform: translateY(60px) scale(0.6); opacity: 0; }
          20% { opacity: 0.9; }
          85% { opacity: 0.9; }
          100% { transform: translateY(-160px) scale(1.4); opacity: 0; }
        }
        .animate-emoji-float {
          animation: emojiFloatUp 3.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }

        /* Comet mascot waves */
        @keyframes mascotWave {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(6deg) translateY(-2px); }
        }
        .animate-mascot-wave {
          animation: mascotWave 5.5s ease-in-out infinite;
        }

        /* Game Button Orbit Ring */
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(110px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(110px) rotate(-360deg); }
        }
        .animate-orbit-dot-1 {
          animation: orbit 9s linear infinite;
        }
        .animate-orbit-dot-2 {
          animation: orbit 9s linear infinite;
          animation-delay: -4.5s;
        }

        /* Custom bubble notification entrance */
        @keyframes bubblePop {
          0% { transform: scale(0.8) translateY(12px); opacity: 0; }
          80% { transform: scale(1.04) translateY(-1px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-bubble-pop {
          animation: bubblePop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        /* V6.16 Redesign Animations */
        @keyframes buttonBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-breathe {
          animation: buttonBreathe 5.5s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.35; filter: blur(12px); }
          50% { opacity: 0.65; filter: blur(18px); }
        }
        .primary-glow {
          animation: glowPulse 4s ease-in-out infinite;
        }

        @keyframes sweep {
          0% { left: -150%; }
          50% { left: 150%; }
          100% { left: 150%; }
        }
        .light-sweep::before {
          content: '';
          position: absolute;
          top: 0;
          width: 30%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.12), transparent);
          transform: skewX(-25deg);
          animation: sweep 9s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        @keyframes sparkDrift1 {
          0% { transform: translate(-80px, -60px) scale(0); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translate(0px, 0px) scale(1); opacity: 0; }
        }
        @keyframes sparkDrift2 {
          0% { transform: translate(90px, 70px) scale(0); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translate(0px, 0px) scale(1); opacity: 0; }
        }
        @keyframes sparkDrift3 {
          0% { transform: translate(-70px, 80px) scale(0); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translate(0px, 0px) scale(1); opacity: 0; }
        }
        @keyframes sparkDrift4 {
          0% { transform: translate(80px, -70px) scale(0); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translate(0px, 0px) scale(1); opacity: 0; }
        }
        .spark-1 { animation: sparkDrift1 7s ease-in-out infinite; }
        .spark-2 { animation: sparkDrift2 9s ease-in-out infinite; }
        .spark-3 { animation: sparkDrift3 8s ease-in-out infinite; }
        .spark-4 { animation: sparkDrift4 6.5s ease-in-out infinite; }
      `}</style>

      {/* Layered Background: Breathing Auroras & Grids */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute w-[65vw] h-[65vw] max-w-[700px] rounded-full bg-gradient-to-tr from-amber-200/25 to-orange-200/20 blur-[130px] left-1/4 top-10 animate-aurora" />
        <div className="absolute w-[55vw] h-[55vw] max-w-[600px] rounded-full bg-gradient-to-br from-peach-200/15 to-orange-300/15 blur-[110px] right-1/4 bottom-10 animate-aurora" style={{ animationDelay: '-6s' }} />
        <div className="absolute inset-0 opacity-[0.012] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Spotlight cursor tracking */}
      <div
        className="absolute w-[450px] h-[450px] rounded-full bg-amber-400/5 blur-[120px] pointer-events-none transition-all duration-300 ease-out z-0 hidden md:block"
        style={{
          left: `${mousePos.x - 225}px`,
          top: `${mousePos.y - 225}px`,
        }}
      />

      {/* ── HERO BANNER SECTION (THE BUTTON IS THE CENTER) ── */}
      <section
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="min-h-screen flex flex-col justify-between items-center px-6 pt-24 pb-16 relative w-full z-10"
      >
        {/* Rotating Globe backdrop */}
        <div className="absolute inset-0 flex items-center justify-center z-0 overflow-hidden pointer-events-none opacity-80">
          <div className="w-[85vw] h-[85vw] max-w-[650px] max-h-[650px] relative rounded-full">
            <div className="absolute inset-0 rounded-full bg-radial-gradient from-amber-400/[0.03] via-transparent to-transparent blur-3xl" />
            <CinematicGlobe />
          </div>
        </div>

        {/* Floating Mascots */}
        <FloatingAvatar index={0} />
        <FloatingAvatar index={1} />
        <FloatingAvatar index={2} />
        <FloatingAvatar index={3} />

        {/* Hero Content Grid - Organized around the CTA Button */}
        <div
          className="flex-1 flex flex-col items-center justify-center text-center relative z-10 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] max-w-4xl w-full"
          style={{
            transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
          }}
        >
          {/* Subtle Capsule Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200 bg-white/70 text-[10px] font-bold tracking-[0.25em] text-stone-500 uppercase mb-8 shadow-sm backdrop-blur-sm animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Zero Login · Peer-to-Peer · Ephemeral
          </div>

          {/* Heading - Shifted Upwards slightly to allow the button to command the center */}
          <h1 className="heading-clamp-h1 font-black tracking-tight text-stone-900 mb-14 max-w-3xl">
            {['EVERY', 'CONVERSATION', 'STARTS', 'WITH'].map((word, i) => (
              <span
                key={word}
                className="reveal-letter"
                style={{ animationDelay: `${i * 0.1}s`, marginRight: '0.12em' }}
              >
                {word}
              </span>
            ))}
            <br />
            <span className="inline-block relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600">
                ONE{' '}
              </span>
              <span
                className={`inline-block min-w-[180px] text-stone-900 transition-all duration-300 font-extrabold tracking-tight ${
                  wordFadeState === 'in' ? 'opacity-100 translate-y-0 filter blur-0' : 'opacity-0 translate-y-2 filter blur-[4px]'
                }`}
              >
                {ROTATING_WORDS[currentWordIdx]}
              </span>
            </span>
          </h1>

          {/* Rotating Curiosity Message */}
          <div className="h-6 overflow-hidden mb-4 flex items-center justify-center relative z-10 select-none">
            <span
              className={`text-amber-500 text-[10px] font-black tracking-[0.2em] uppercase transition-all duration-300 block ${
                curiosityFadeState === 'in' ? 'opacity-100 translate-y-0 filter blur-0' : 'opacity-0 -translate-y-2 filter blur-[2px]'
              }`}
            >
              {CURIOSITY_MESSAGES[curiosityIdx]}
            </span>
          </div>

          {/* ── THE REDESIGNED PREMIUM CTA BUTTON ── */}
          <div className={`relative ${displayName ? 'my-6' : 'my-12'} z-20 flex items-center justify-center`}>
            
            {/* Ambient golden backing pulse */}
            <div className="absolute -inset-2 rounded-[36px] bg-gradient-to-r from-amber-500/10 via-orange-500/15 to-amber-600/10 opacity-60 blur-md primary-glow pointer-events-none z-0" />
            
            {/* Sparkles drifting toward button */}
            <div className="absolute w-[240px] h-[240px] pointer-events-none z-0 hidden sm:block">
              <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/90 blur-[1px] spark-1" style={{ top: '50%', left: '50%' }} />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-orange-400/90 blur-[1px] spark-2" style={{ top: '50%', left: '50%' }} />
              <div className="absolute w-2 h-2 rounded-full bg-yellow-400/95 blur-[1px] spark-3" style={{ top: '50%', left: '50%' }} />
              <div className="absolute w-1 h-1 rounded-full bg-amber-300/80 blur-[1px] spark-4" style={{ top: '50%', left: '50%' }} />
            </div>

            {/* Orbiting particles */}
            <div className="absolute w-[240px] h-[240px] rounded-full border border-amber-500/10 pointer-events-none z-0 hidden sm:block">
              <div className="absolute w-2 h-2 rounded-full bg-amber-500/60 shadow-lg animate-orbit-dot-1" />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-orange-500/60 shadow-lg animate-orbit-dot-2" />
            </div>

            {/* Dynamic Story Speech Notification Bubble (Left) */}
            {storyNotification && storyNotification.side === 'left' && (
              <div className="absolute left-[-240px] top-[-10px] hidden lg:block max-w-[190px] bg-white border border-stone-200/80 rounded-2xl rounded-br-none p-3 shadow-xl text-left animate-bubble-pop z-30">
                <p className="text-[10px] font-bold text-stone-600 leading-snug">{storyNotification.text}</p>
                <div className="absolute right-[-6px] bottom-3 w-3 h-3 bg-white border-r border-b border-stone-200/80 transform rotate-[-45deg]" />
              </div>
            )}

            {/* Dynamic Story Speech Notification Bubble (Right) */}
            {storyNotification && storyNotification.side === 'right' && (
              <div className="absolute right-[-240px] top-[-10px] hidden lg:block max-w-[190px] bg-white border border-stone-200/80 rounded-2xl rounded-bl-none p-3 shadow-xl text-left animate-bubble-pop z-30">
                <p className="text-[10px] font-bold text-stone-600 leading-snug">{storyNotification.text}</p>
                <div className="absolute left-[-6px] bottom-3 w-3 h-3 bg-white border-l border-t border-stone-200/80 transform rotate-[-45deg]" />
              </div>
            )}

            {/* Continuous Upward Floating Reactions */}
            {floatingEmojis.map((item) => (
              <span
                key={item.id}
                className="absolute text-2xl pointer-events-none animate-emoji-float z-10"
                style={{
                  left: `${item.left - 50}%`,
                }}
              >
                {item.emoji}
              </span>
            ))}

            {/* Click Explosion particles */}
            {clickParticles.map((p) => (
              <span
                key={p.id}
                className="absolute text-xl pointer-events-none z-30 font-bold"
                style={{
                  transform: p.active ? `translate(${p.x}px, ${p.y}px) scale(${p.scale})` : 'translate(0px, 0px) scale(0.5)',
                  opacity: p.active ? 0 : 1,
                  transition: 'transform 1.2s cubic-bezier(0.1, 0.8, 0.25, 1), opacity 1.2s ease-out',
                  color: p.emoji ? undefined : '#F5A623',
                }}
              >
                {p.emoji || '✦'}
              </span>
            ))}
            
            {/* The main button container */}
            <button
              ref={buttonRef}
              onClick={handleStartNewConversation}
              disabled={isLoading}
              className={`relative btn-shine light-sweep animate-breathe w-64 h-20 bg-stone-900 hover:bg-stone-800 text-stone-100 font-extrabold text-lg rounded-3xl shadow-[0_16px_40px_rgba(245,166,35,0.22)] border border-stone-800 flex flex-col items-center justify-center gap-1 overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 hover:-translate-y-1 group active:shadow-[0_4px_12px_rgba(245,166,35,0.15)] ${isExploded ? 'scale-90 shadow-inner border-amber-500/30' : ''}`}
              style={{
                zIndex: 10,
                transform: `translate3d(${magneticOffset.x}px, ${magneticOffset.y}px, 0) scale(${isExploded ? 0.9 : 1})`,
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="tracking-wide text-white text-sm font-black">✨ Start New Conversation</span>
              </div>
              <span className="text-[9px] font-bold tracking-[0.2em] text-amber-400/80 uppercase">Meet someone new</span>
            </button>
          </div>

          {/* V6.16 Resume Setup Glass Card */}
          {displayName && (
            <div className={`mt-2 flex flex-col items-center gap-4 relative z-10 max-w-xs w-full px-4 transition-all duration-700 transform ${showResumeCard ? 'opacity-100 translate-y-0 filter blur-0 animate-fade-in' : 'opacity-0 translate-y-3 filter blur-md'}`}>
              <div className="w-full glass-card rounded-3xl p-5 border border-white/40 bg-white/45 backdrop-blur-xl shadow-lg text-left relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl group">
                <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-amber-500/5 blur-xl pointer-events-none" />
                
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[9px] text-stone-400 uppercase font-black tracking-wider">
                    Resume Setup
                  </span>
                  <span className="text-[8px] font-mono text-stone-400 bg-stone-200/50 px-2 py-0.5 rounded-full font-bold">
                    Active
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
                    <span className="w-4 text-center">👤</span>
                    <span className="text-stone-900 font-extrabold truncate">{displayName}</span>
                  </div>

                  {languagesDetail && (
                    <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                      <span className="w-4 text-center">🗣️</span>
                      <span className="truncate max-w-[200px]">{languagesDetail}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                    <span className="w-4 text-center">🎲</span>
                    <span className="capitalize">{matchMode.toLowerCase()} Mode</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreferenceModal(true)}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-[10px] font-bold text-stone-600 hover:bg-stone-50/50 active:scale-[0.98] transition-all duration-200 text-center"
                  >
                    Edit Setup
                  </button>

                  <button
                    onClick={handleResumeSetup}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-amber-500 border border-amber-500 text-[10px] font-black text-stone-950 hover:bg-amber-400 active:scale-[0.98] transition-all duration-200 text-center shadow-[0_4px_12px_rgba(245,166,35,0.22)]"
                  >
                    Resume
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating Mini counters */}
        <div className="w-full max-w-xl grid grid-cols-3 gap-4 relative z-10 px-4 mt-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          {[
            { label: 'ONLINE NOW', value: onlineCount },
            { label: 'IN QUEUE', value: waitingCount },
            { label: 'COUNTRIES', value: countriesCount },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-3 rounded-2xl border border-white bg-white/55 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <span className="text-lg sm:text-2xl font-black tracking-tight">
                <RollingCounter value={stat.value} />
              </span>
              <span className="block text-[8px] font-bold uppercase tracking-[0.2em] text-stone-400 mt-1">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE ACTIVITY RIBBON ── */}
      <LiveActivityRibbon />

      {/* ── INTERACTIVE FAKE DEMO & PHILOSOPHY SECTIONS ── */}
      <section className="relative w-full py-28 px-6 bg-[#FDFDFB] border-t border-stone-200/50 z-10 flex flex-col items-center">
        <div className="absolute w-[450px] h-[450px] rounded-full bg-amber-400/5 blur-[120px] pointer-events-none -translate-x-1/2 left-1/2 top-1/4" />

        <div className="max-w-6xl w-full grid md:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col items-start text-left max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-stone-200 bg-white text-[9px] font-bold tracking-[0.2em] text-amber-600 uppercase mb-5 shadow-sm">
              ✦ Live Simulator
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-stone-900 mb-6">
              ZERO CONFIG.
              <br />
              JUST MATCH.
            </h2>
            <p className="text-stone-500 text-sm leading-relaxed mb-8 font-bold">
              We built Kaboom TV to strip away the friction of modern web communication. No signup gates, no configuration details. Just pure connections, routed P2P.
            </p>

            <div className="flex flex-col gap-5 w-full">
              {[
                { step: '1', title: 'Start session instantly', desc: 'Secure connection variables initialize in memory without databases.' },
                { step: '2', title: 'P2P tunnel handshake', desc: 'We WebRTC-bridge matching peers directly, keeping audio/video off servers.' },
                { step: '3', title: 'Interact or skip', desc: 'Exchange chat messages, likes, reactions, and double-tap swap layouts.' },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 items-start">
                  <div className="w-7 h-7 rounded-lg border border-stone-200 bg-white flex items-center justify-center text-[10px] font-black text-amber-600 shrink-0 shadow-sm">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-stone-800 font-bold text-xs uppercase tracking-wider">{item.title}</h4>
                    <p className="text-stone-500 text-xs mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center relative">
            <div className="absolute inset-0 bg-radial-gradient from-amber-500/10 via-transparent to-transparent blur-3xl pointer-events-none" />
            <InteractiveDemo />
          </div>
        </div>
      </section>

      {/* ── PREMIUM FEATURE CARDS GRID ── */}
      <section className="w-full py-28 px-6 bg-[#FAF9F7] border-t border-stone-200/50 z-10 flex flex-col items-center">
        <div className="max-w-6xl w-full text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-stone-200 bg-white text-[9px] font-bold tracking-[0.2em] text-amber-600 uppercase mb-5 shadow-sm">
            ✦ Core Pipeline
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-stone-900 mb-16">
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
                desc: 'Premium ivory light interface variables inspired by high-end consumer hardware interfaces.',
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
                className="glass-card flex flex-col items-start text-left p-8 group hover:scale-[1.01] hover:border-amber-500/20 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-white border border-stone-200/40 flex items-center justify-center text-lg mb-6 group-hover:border-amber-500/20 group-hover:bg-amber-500/5 transition-all shadow-sm">
                  {card.icon}
                </div>
                <h3 className="text-stone-850 font-extrabold tracking-tight mb-2 text-sm uppercase">
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

      {/* ── AI SEARCH ENGINE READINESS KNOWLEDGE BASE (FAQ) ── */}
      <section className="w-full py-24 px-6 bg-[#FDFDFB] border-t border-stone-200/50 z-10 flex flex-col items-center">
        <div className="max-w-4xl w-full text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-stone-200 bg-white text-[9px] font-bold tracking-[0.2em] text-amber-600 uppercase mb-5 shadow-sm">
            ✦ Knowledge Base
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-stone-900 mb-12">
            Frequently Asked Questions
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">What is Kaboom TV?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  Kaboom TV is a premium, free anonymous random video chat platform that allows you to instantly meet new people worldwide. Experience clean WebRTC connections, fluid layout docking, and dynamic controls with zero registration loops.
                </p>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">How does Kaboom TV work?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  We use Supabase Realtime synchronization pools to pair online participants in under 400ms. Once a match is made, the video and audio streams are negotiated directly peer-to-peer using secure WebRTC connections.
                </p>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">Is Kaboom TV free?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  Yes, Kaboom TV is completely free to use. There are no subscriptions, coin purchases, premium limits, or hidden fees. Just hit Start Chat and join the conversation.
                </p>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">Do I need an account?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  No account, email address, phone number, or sign-up form is required. Kaboom TV is anonymous by design, keeping registration friction to zero.
                </p>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">Is Kaboom TV anonymous?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  Absolutely. We do not store personally identifiable information, session history, or logs of your conversations. Your video feed is routed locally and is never processed on our servers.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">Can I use Kaboom TV on mobile?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  Yes! Kaboom TV features a responsive safe-area layout inspired by Snapchat and Instagram Live. Drag-to-snap self previews, large one-handed touch targets, and swipe gestures work flawlessly on any iOS or Android browser.
                </p>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">How do I skip someone?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  Simply click the Next skip button on the controls panel. On mobile, perform a Swipe-Left gesture across the viewport to trigger a smooth skip transition and match with a new stranger.
                </p>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">Can I chat with messages?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  Yes. Kaboom TV contains a sliding bottom sheet chat drawer on mobile and a translucent side-panel drawer on desktop. Standard floating transparent text bubbles display temporarily when the drawer is closed.
                </p>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">How does matching work?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  The matchmaking queue pairs users continuously and is completely self-healing. When you select your chat preferences (gender, location, language), the matching engine uses Postgres advisory locking to execute conflict-free passes.
                </p>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 mb-2">Is my data stored?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  No. We use browser localStorage solely to persist your anonymous session token across refreshes. Temporary signaling records and logs are periodically purged automatically by the cleanup service.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MINI PHILOSOPHY LOOP ROADMAP ── */}
      <section className="relative w-full py-28 px-6 bg-[#FDFDFB] border-t border-stone-200/50 z-10 flex flex-col items-center">
        <div className="max-w-4xl w-full text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mb-8 animate-pulse shadow-sm">
            💫
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-stone-900 max-w-lg mb-6 leading-none">
            YOUR NEXT
            <br />
            STORY AWAITS.
          </h2>
          <p className="text-stone-500 text-sm max-w-sm leading-relaxed mb-10 font-bold">
            Join thousands of active peers connecting right now. Zero signup loops, zero trackers. Just matches.
          </p>

          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 opacity-40 blur-md group-hover:opacity-75 transition-opacity duration-300 pointer-events-none" />
            <button
              onClick={handleStartNewConversation}
              disabled={isLoading}
              className="relative btn-shine text-sm px-8 py-3.5 bg-stone-900 text-stone-100 hover:bg-stone-800 font-black rounded-full hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 flex items-center gap-2 border border-stone-800 shadow-md"
            >
              <span>Match Instantly</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      </section>

      {showPreferenceModal && (
        <PreferenceModal
          isOpen={showPreferenceModal}
          onClose={() => setShowPreferenceModal(false)}
          onSave={async (prefs) => {
            setStarting(true);
            try {
              const data = await startSession();
              await apiService.submitPreferences(data.sessionId, data.sessionToken, prefs);
              setShowPreferenceModal(false);
              navigate('/chat');
            } catch (error) {
              showToast('error', error instanceof Error ? error.message : 'Failed to join chat');
              setStarting(false);
            }
          }}
          currentPreferences={getSavedPreferences()}
        />
      )}

      {showTutorial && (
        <TutorialSlider
          onClose={() => {
            setShowTutorial(false);
            setShowPreferenceModal(true);
          }}
        />
      )}
    </div>
  );
}

function TutorialSlider({ onClose }: { onClose: () => void }) {
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      title: "Choose your profile",
      description: "Set up your public identity and preferences to match with compatible peers.",
      icon: "👤"
    },
    {
      title: "Meet people instantly",
      description: "Join the queue and get connected securely over direct peer-to-peer tunnels.",
      icon: "⚡"
    },
    {
      title: "Swipe Next anytime",
      description: "Don't like the match? Swipe left or press Next to match with someone new instantly.",
      icon: "🔄"
    }
  ];

  const handleNext = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      localStorage.setItem('kaboom_tutorial_seen', 'true');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-4">
      <div className="relative w-full max-w-md bg-stone-900 border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-between text-center min-h-[420px] shadow-2xl">
        {/* Slide Icon */}
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-4xl mb-6 shadow-inner animate-pulse">
          {slides[slide].icon}
        </div>

        {/* Title & Desc */}
        <div className="flex-1 flex flex-col justify-center mb-8">
          <h3 className="text-2xl font-black text-stone-100 tracking-tight mb-3">
            {slides[slide].title}
          </h3>
          <p className="text-stone-400 text-sm leading-relaxed max-w-[280px] mx-auto font-medium">
            {slides[slide].description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {slides.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                slide === i ? "bg-amber-500 w-6" : "bg-white/20"
              )}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={handleNext}
          className="w-full relative group"
        >
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 opacity-60 blur-sm group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <div className="relative text-sm px-6 py-3.5 bg-stone-950 border border-amber-500/30 text-stone-100 font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
            {slide === slides.length - 1 ? 'Get Started' : 'Next'}
          </div>
        </button>
      </div>
    </div>
  );
}

