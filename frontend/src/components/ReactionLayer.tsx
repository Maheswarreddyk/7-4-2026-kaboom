import { useState, forwardRef, useImperativeHandle, useCallback } from 'react';

export interface ReactionLayerRef {
  triggerReaction: (emoji: string) => void;
}

export const ReactionLayer = forwardRef<ReactionLayerRef>((_props, ref) => {
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string; left: number; delay: number }>>([]);

  const triggerReaction = useCallback((emoji: string) => {
    const newReactions = Array.from({ length: 6 }).map((_, i) => ({
      id: Math.random() + i,
      emoji,
      left: Math.random() * 80 + 10,
      delay: Math.random() * 0.4
    }));
    setReactions(prev => [...prev, ...newReactions]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => !newReactions.some(nr => nr.id === r.id)));
    }, 3000);
  }, []);

  useImperativeHandle(ref, () => ({
    triggerReaction
  }));

  if (reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[120] pointer-events-none overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-0 text-4xl animate-float-up opacity-0"
          style={{
            left: `${r.left}%`,
            animationDelay: `${r.delay}s`,
            textShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div className={
            r.emoji === '❤️' ? 'animate-bounce' :
            r.emoji === '👏' ? 'animate-spin-slow' :
            r.emoji === '😂' ? 'animate-pulse' : ''
          }>
            {r.emoji}
          </div>
        </div>
      ))}
    </div>
  );
});
