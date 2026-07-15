import { useState, forwardRef, useImperativeHandle, useCallback } from 'react';

export interface ReactionLayerRef {
  triggerReaction: (emoji: string, fromLocal: boolean) => void;
  clearReactions: () => void;
}

interface ReactionNode {
  id: string;
  emoji: string;
  fromLocal: boolean;
  startX: string;
  xOffset: number;
  rot: number;
  scale: number;
}

export const ReactionLayer = forwardRef<ReactionLayerRef>((_props, ref) => {
  const [reactions, setReactions] = useState<ReactionNode[]>([]);

  const triggerReaction = useCallback((emoji: string, fromLocal: boolean) => {
    const startX = fromLocal ? '25%' : '75%';
    const xOffset = Math.floor(Math.random() * 60 - 30); // -30px to +30px
    const rot = Math.floor(Math.random() * 60 - 30); // -30deg to +30deg
    const scale = 0.8 + Math.random() * 0.6; // 0.8 to 1.4

    const newReaction: ReactionNode = { 
      id: Math.random().toString(36).substr(2, 9), 
      emoji, 
      fromLocal,
      startX,
      xOffset,
      rot,
      scale
    };

    setReactions(prev => {
      const next = [...prev, newReaction];
      if (next.length > 5) {
        return next.slice(next.length - 5);
      }
      return next;
    });

    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 1500); // 1.5s lifecycle
  }, []);

  const clearReactions = useCallback(() => {
    setReactions([]);
  }, []);

  useImperativeHandle(ref, () => ({
    triggerReaction,
    clearReactions
  }));

  if (reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[120] pointer-events-none overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-0 text-6xl animate-emoji-float origin-center"
          style={{
            left: `calc(${r.startX} + ${r.xOffset}px)`,
            '--emoji-rot': `${r.rot}deg`,
            '--emoji-scale': r.scale,
            '--x-drift': `${r.rot * 3}px`, 
            textShadow: '0 8px 16px rgba(0,0,0,0.4)',
          } as React.CSSProperties}
        >
          {r.emoji}
          {/* Particle Burst at peak */}
          <div className="absolute inset-0 flex items-center justify-center animate-emoji-particles opacity-0 pointer-events-none">
            <span className="absolute w-3 h-3 rounded-full bg-yellow-400" style={{ transform: 'translate(0, -40px)' }} />
            <span className="absolute w-3 h-3 rounded-full bg-pink-400" style={{ transform: 'translate(35px, -20px)' }} />
            <span className="absolute w-3 h-3 rounded-full bg-purple-400" style={{ transform: 'translate(-35px, -20px)' }} />
            <span className="absolute w-3 h-3 rounded-full bg-blue-400" style={{ transform: 'translate(25px, 35px)' }} />
            <span className="absolute w-3 h-3 rounded-full bg-green-400" style={{ transform: 'translate(-25px, 35px)' }} />
          </div>
        </div>
      ))}
    </div>
  );
});
