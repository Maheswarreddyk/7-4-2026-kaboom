import { useState } from 'react';
import { cn } from '../utils/index.js';
import { playTapSound } from '../utils/audio.js';

interface TutorialOverlayProps {
  onClose: () => void;
}

const TUTORIAL_CARDS = [
  {
    title: 'Meet Instantly ✦',
    description: 'Kaboom connects you instantly with random people globally via peer-to-peer video.',
    emoji: '🌎',
    color: 'from-amber-500 to-orange-500'
  },
  {
    title: 'Swipe Left to Skip 👉',
    description: 'Don\'t feel the vibe? Swipe left on your phone or click "Next" on desktop to match with someone new.',
    emoji: '⏩',
    color: 'from-purple-500 to-indigo-500'
  },
  {
    title: 'Double Tap to Like 💜',
    description: 'Double tap the screen or click "Like". If they like you back, it\'s a Mutual Match and unlocks full chat!',
    emoji: '❤️',
    color: 'from-red-500 to-pink-500'
  }
];

export function TutorialOverlay({ onClose }: TutorialOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('kaboom_tutorial_dismissed') === 'true';
  });

  if (dismissed) return null;

  const handleNext = () => {
    playTapSound();
    if (currentIndex < TUTORIAL_CARDS.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      localStorage.setItem('kaboom_tutorial_dismissed', 'true');
      setDismissed(true);
      onClose();
    }
  };

  const card = TUTORIAL_CARDS[currentIndex];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-xl select-none animate-fade-in">
      <div className="max-w-sm w-full mx-4 p-8 rounded-3xl border border-white/5 bg-stone-900/90 shadow-2xl relative overflow-hidden flex flex-col items-center text-center animate-spring-in">
        
        {/* Animated ambient background radial aura */}
        <div className={cn(
          "absolute -top-32 w-72 h-72 rounded-full bg-gradient-to-r blur-[80px] opacity-25 transition-all duration-700",
          card.color
        )} />

        {/* Floating animated emoji container */}
        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl mb-6 relative z-10 animate-bounce" style={{ animationDuration: '2.5s' }}>
          {card.emoji}
        </div>

        {/* Title & Description */}
        <h2 className="text-xl font-extrabold tracking-tight text-white mb-2 relative z-10 transition-all duration-300">
          {card.title}
        </h2>
        <p className="text-stone-400 text-xs leading-relaxed mb-8 px-2 relative z-10 h-14 overflow-hidden transition-all duration-300">
          {card.description}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-6 relative z-10">
          {TUTORIAL_CARDS.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                idx === currentIndex ? "w-5 bg-amber-500" : "w-1.5 bg-white/20"
              )}
            />
          ))}
        </div>

        {/* Next / Got it Button */}
        <button
          onClick={handleNext}
          className="w-full relative group z-10"
        >
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 opacity-60 blur-sm group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <div className="relative text-xs px-6 py-3.5 bg-stone-950 border border-amber-500/30 text-stone-100 font-extrabold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
            {currentIndex === TUTORIAL_CARDS.length - 1 ? 'Got it, let\'s go!' : 'Next'}
          </div>
        </button>
      </div>
    </div>
  );
}
