import { useEffect, useState, useRef } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { cn } from '../utils/index.js';
import { QueueCard } from './QueueCard.js';

interface SearchingAnimationProps {
  status?: string;
  partnerProfile?: any;
  isQueuePaused?: boolean;
  elapsed: number;
  matchMode: string;
  onOpenPreferences?: () => void;
  onResumeQueue?: () => void;
  onPauseQueue?: () => void;
  onLeaveQueue?: () => void;
  stats: { online: number; searching: number; wait: number };
  onDisableStrict?: () => void;
}

export function SearchingAnimation({
  status,
  partnerProfile,
  isQueuePaused = false,
  elapsed,
  matchMode,
  onOpenPreferences,
  onResumeQueue,
  onPauseQueue,
  onLeaveQueue,
  stats,
  onDisableStrict
}: SearchingAnimationProps) {
  const { width, height } = useResponsiveLayout();
  const isMinimalLayout = width < 560 || height < 500;

  const activeMatchMode = localStorage.getItem('kaboom_match_mode') || 'RANDOM';
  const university = localStorage.getItem('kaboom_university') || '';

  const [animationStep, setAnimationStep] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isTabVisible = useRef(true);

  // Fading text transitions
  const [fadingText, setFadingText] = useState('Starting search...');
  const [fadeOpacity, setFadeOpacity] = useState(1);

  // Rotating messages during search stages
  useEffect(() => {
    if (status === 'PARTNER_LEFT' || isQueuePaused) return;
    const interval = setInterval(() => {
      setAnimationStep((prev) => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [status, isQueuePaused]);

  const randomMessages = [
    "Searching worldwide...",
    "Checking active users...",
    "Finding someone online...",
    "Finding your next conversation..."
  ];

  const smartMessages = [
    "Looking for shared interests...",
    "Checking university networks...",
    "Searching nearby regions...",
    "Matching profile attributes..."
  ];

  const strictMessages = [
    "Searching exact criteria...",
    "Analyzing selected filters...",
    university ? `Waiting for another ${university} student...` : "Searching selected campus network...",
    "Exact matching takes slightly longer..."
  ];

  const getRotatingMessages = () => {
    if (activeMatchMode === 'STRICT') return strictMessages;
    if (activeMatchMode === 'PREFER') return smartMessages;
    return randomMessages;
  };

  const currentMessages = getRotatingMessages();
  const currentStageText = currentMessages[animationStep % currentMessages.length];

  // Apply smooth fade state transition
  useEffect(() => {
    setFadeOpacity(0);
    const t = setTimeout(() => {
      setFadingText(currentStageText);
      setFadeOpacity(1);
    }, 150);
    return () => clearTimeout(t);
  }, [currentStageText]);

  // Tab visibility event listeners
  useEffect(() => {
    const handleVisibility = () => {
      isTabVisible.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // 3D Perspective Network Globe Projection Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let canvasW = (canvas.width = window.innerWidth);
    let canvasH = (canvas.height = window.innerHeight);

    const handleResize = () => {
      canvasW = canvas.width = window.innerWidth;
      canvasH = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 1. Generate 3D Globe Nodes (Fibonacci sphere distribution)
    interface Node3D {
      x: number;
      y: number;
      z: number;
    }
    const NODES_COUNT = 55;
    const GLOBE_RADIUS = Math.min(220, Math.min(canvasW, canvasH) * 0.35);
    const globeNodes: Node3D[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < NODES_COUNT; i++) {
      const nodeY = 1 - (i / (NODES_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - nodeY * nodeY);
      const theta = phi * i;

      const nodeX = Math.cos(theta) * radiusAtY;
      const nodeZ = Math.sin(theta) * radiusAtY;

      globeNodes.push({
        x: nodeX * GLOBE_RADIUS,
        y: nodeY * GLOBE_RADIUS,
        z: nodeZ * GLOBE_RADIUS
      });
    }

    // 2. Generate background floating particles
    interface Particle {
      x: number;
      y: number;
      z: number;
      size: number;
      driftSpeed: number;
    }
    const PARTICLES_COUNT = 30;
    const backgroundParticles: Particle[] = Array.from({ length: PARTICLES_COUNT }).map(() => ({
      x: (Math.random() - 0.5) * canvasW * 1.5,
      y: (Math.random() - 0.5) * canvasH * 1.5,
      z: Math.random() * 300 - 150,
      size: Math.random() * 1.5 + 0.8,
      driftSpeed: Math.random() * 0.15 + 0.05
    }));

    // Local rotation values
    let angleY = 0;
    let angleX = 0;

    const animate = () => {
      if (!isTabVisible.current) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvasW, canvasH);

      // A. Ambient Volumetric glowing lights behind the globe
      const ambientGlow = ctx.createRadialGradient(
        canvasW / 2,
        canvasH / 2.3,
        50,
        canvasW / 2,
        canvasH / 2.3,
        GLOBE_RADIUS * 1.8
      );
      ambientGlow.addColorStop(0, 'rgba(255, 193, 7, 0.05)');
      ambientGlow.addColorStop(0.5, 'rgba(255, 91, 53, 0.02)');
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Slowly increment rotation angles
      angleY += 0.0025;
      angleX = Math.sin(angleY * 0.5) * 0.15; // Slow breathing pitch oscillation

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      // Camera focal config
      const fov = 400;
      const camCenterY = canvasH / 2.3;

      // Projected coordinates storage
      const projectedNodes: { px: number; py: number; pz: number; depthOpacity: number }[] = [];

      // B. Rotate and project globe nodes
      for (const node of globeNodes) {
        // Rotate around Y-axis
        let rx = node.x * cosY - node.z * sinY;
        let rz = node.z * cosY + node.x * sinY;

        // Rotate around X-axis
        let ry = node.y * cosX - rz * sinX;
        let rz2 = rz * cosX + node.y * sinX;

        // Depth perspective calculation
        const perspective = fov / (fov + rz2);
        const px = canvasW / 2 + rx * perspective;
        const py = camCenterY + ry * perspective;

        // Normalize depth scale for opacity (front nodes brighter, back nodes fainter)
        const depthOpacity = (fov - rz2) / (fov * 1.5);

        projectedNodes.push({ px, py, pz: rz2, depthOpacity });
      }

      // C. Draw connections (lines between nodes)
      ctx.lineWidth = 0.5;
      for (let i = 0; i < NODES_COUNT; i++) {
        for (let j = i + 1; j < NODES_COUNT; j++) {
          const dx = globeNodes[i].x - globeNodes[j].x;
          const dy = globeNodes[i].y - globeNodes[j].y;
          const dz = globeNodes[i].z - globeNodes[j].z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Connection limit threshold
          if (dist < GLOBE_RADIUS * 0.72) {
            const nodeA = projectedNodes[i];
            const nodeB = projectedNodes[j];

            ctx.beginPath();
            ctx.moveTo(nodeA.px, nodeA.py);
            ctx.lineTo(nodeB.px, nodeB.py);

            // Compute connection line opacity based on depth and distance
            const scaleFactor = (1 - dist / (GLOBE_RADIUS * 0.72));
            const lineOpacity = Math.max(0, scaleFactor * nodeA.depthOpacity * nodeB.depthOpacity * 0.18);

            ctx.strokeStyle = `rgba(255, 193, 7, ${lineOpacity})`;
            ctx.stroke();
          }
        }
      }

      // D. Draw projected nodes
      for (const p of projectedNodes) {
        ctx.beginPath();
        const nodeRadius = Math.max(0.8, p.depthOpacity * 2.2);
        ctx.arc(p.px, p.py, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 138, 0, ${p.depthOpacity * 0.7})`;
        ctx.fill();
      }

      // E. Draw floating background stars/particles with parallax
      for (const part of backgroundParticles) {
        part.y -= part.driftSpeed;
        // Reset floating particles if they drift off canvas
        if (part.y < -canvasH / 2) {
          part.y = canvasH / 2;
          part.x = (Math.random() - 0.5) * canvasW * 1.5;
        }

        const perspective = fov / (fov + part.z);
        const px = canvasW / 2 + part.x * perspective;
        const py = camCenterY + part.y * perspective;

        if (px >= 0 && px <= canvasW && py >= 0 && py <= canvasH) {
          const depthOpacity = (fov - part.z) / (fov * 1.8);
          ctx.beginPath();
          ctx.arc(px, py, part.size * perspective, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 193, 7, ${depthOpacity * 0.35})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full bg-stone-950 overflow-hidden select-none z-0 flex flex-col items-center justify-center">
      {/* 3D Global connectivity canvas network */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Unified Waiting Room Content Layer */}
      <div className={cn(
        "relative z-10 flex flex-col items-center w-full max-w-[380px] sm:max-w-[420px] mx-auto px-4 text-center transition-all duration-500",
        isMinimalLayout ? "gap-2" : "gap-6"
      )}>
        {status === 'PARTNER_LEFT' ? (
          /* Case A: Partner Left */
          <div className="flex flex-col items-center animate-fade-in w-full">
            <div className="w-16 h-16 rounded-full border border-red-500/25 bg-red-500/5 flex items-center justify-center relative shadow-2xl mb-4">
              <span className="text-2xl animate-bounce">👋</span>
            </div>
            <p className="text-red-400 font-extrabold text-base tracking-tight mb-1">
              {partnerProfile?.displayName || 'Partner'} left.
            </p>
            <p className="text-stone-400 text-xs font-semibold tracking-wide animate-pulse mb-4">
              Finding another person...
            </p>
          </div>
        ) : isQueuePaused ? (
          /* Case B: Queue Paused */
          <div className="flex flex-col items-center animate-fade-in w-full">
            <div className="w-16 h-16 rounded-full border border-amber-500/20 bg-amber-500/5 flex items-center justify-center relative shadow-2xl mb-4">
              <span className="text-2xl">⏸️</span>
            </div>
            <p className="text-amber-500 font-extrabold text-base tracking-tight mb-1">
              Matchmaking Paused
            </p>
            <p className="text-stone-400 text-xs font-semibold tracking-wide mb-4">
              Resume matching when you are ready
            </p>
          </div>
        ) : (
          /* Case C: Standard Active Matchmaking */
          <div className="flex flex-col items-center w-full">
            {/* Center Breathing Radar (No spinning, calm breathing animation) */}
            <div className={cn("relative shrink-0 flex items-center justify-center", isMinimalLayout ? "mb-2" : "mb-5")}>
              {/* Outer pulsing expanding rings */}
              <div className="absolute rounded-full border border-amber-500/20 ring-expand-glow w-16 h-16 sm:w-20 sm:h-20" />
              <div className="absolute rounded-full border border-amber-500/10 ring-expand-glow w-24 h-24 sm:w-28 sm:h-28" style={{ animationDelay: '1.2s' }} />

              {/* Central glowing core badge */}
              <div className="rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center relative shadow-2xl glass w-16 h-16 sm:w-20 sm:h-20">
                <div className="absolute rounded-full border border-amber-500/20 bg-amber-500/10 radar-breathing w-12 h-12 sm:w-14 sm:h-14" />
                <svg
                  className="w-6 h-6 text-amber-400 relative z-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </div>
            </div>

            {/* Fading matched stages text */}
            <p
              className="text-stone-100 font-bold text-xs tracking-tight mb-2.5 h-5 overflow-hidden transition-opacity duration-150 shrink-0 select-none"
              style={{ opacity: fadeOpacity }}
            >
              {fadingText}
            </p>

            {/* Jump loader dots */}
            <div className="flex items-center justify-center gap-1.5 shrink-0 mb-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Cohesive Queue Dashboard panel */}
        <div className="w-full shrink-0">
          <QueueCard
            elapsed={elapsed}
            matchMode={matchMode}
            isQueuePaused={isQueuePaused}
            onOpenPreferences={onOpenPreferences}
            onResumeQueue={onResumeQueue}
            onPauseQueue={onPauseQueue}
            onLeaveQueue={onLeaveQueue}
            stats={stats}
            onDisableStrict={onDisableStrict}
          />
        </div>
      </div>
    </div>
  );
}
