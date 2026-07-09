import React from 'react';
import { cn } from '../utils/index.js';
import { playTapSound, playLikeSound, playSwipeSound } from '../utils/audio.js';

export interface DockButtonProps {
  onClick?: () => void;
  icon: React.ReactNode;
  label?: string;
  tooltip?: string;
  active?: boolean;
  danger?: boolean;
  warning?: boolean;
  disabled?: boolean;
  badgeCount?: number;
  soundType?: 'tap' | 'like' | 'swipe';
  className?: string;
  sizeStyle?: React.CSSProperties;
}

export function DockButton({
  onClick,
  icon,
  label,
  tooltip,
  active = false,
  danger = false,
  warning = false,
  disabled = false,
  badgeCount = 0,
  soundType = 'tap',
  className = '',
  sizeStyle = {},
}: DockButtonProps) {
  const handlePress = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled && !danger) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (soundType === 'like') {
      playLikeSound();
    } else if (soundType === 'swipe') {
      playSwipeSound();
    } else {
      playTapSound();
    }

    try {
      if (soundType === 'like' && navigator.vibrate) {
        navigator.vibrate([15, 10, 15]);
      } else if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}

    onClick?.();
  };

  return (
    <button
      onPointerDown={handlePress}
      disabled={disabled}
      title={tooltip}
      className={cn(
        "relative flex items-center justify-center rounded-full border transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.08] active:scale-[0.92] group shadow-md shrink-0",
        danger
          ? "bg-red-600 border-red-500 text-white hover:bg-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.45)]"
          : warning
          ? "bg-amber-500/10 border-amber-500/20 text-yellow-400 hover:bg-amber-500/20 hover:border-amber-500/30"
          : active
          ? "bg-amber-500 border-amber-400 text-stone-950 shadow-[0_0_16px_rgba(245,166,37,0.35)]"
          : "bg-white/5 border-white/5 text-white/80 hover:bg-white/10 hover:border-white/10",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
      style={{
        width: 'var(--control-size)',
        height: 'var(--control-size)',
        ...sizeStyle
      }}
    >
      <div className="w-[var(--icon-size)] h-[var(--icon-size)] flex items-center justify-center">
        {icon}
      </div>

      {label && (
        <span className="hidden sm:inline text-xs font-semibold ml-2 select-none">
          {label}
        </span>
      )}

      {badgeCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white border border-stone-950 animate-pulse">
          {badgeCount}
        </span>
      )}
    </button>
  );
}
