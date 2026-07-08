import React, { useRef, useState } from 'react';
import { cn } from '../utils/index.js';

interface GestureLayerProps {
  onSwipeLeft: () => void; // Next Skip
  onDoubleTap: () => void; // Like partner
  disabled?: boolean;      // Disable e.g. when chat is open or dragging PIP
  children?: React.ReactNode;
}

export function GestureLayer({
  onSwipeLeft,
  onDoubleTap,
  disabled = false,
  children,
}: GestureLayerProps) {
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const [dragOffset, setDragOffset] = useState(0); // Horizontal translation for visual feedback
  const [isDragging, setIsDragging] = useState(false);
  const lastTapRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return;
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStart.current.x;
    
    // Only track left-wards drag (skipping)
    if (diffX < 0) {
      setDragOffset(diffX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStart.current.x;
    const timeDelta = Date.now() - touchStart.current.time;
    const velocity = Math.abs(diffX) / (timeDelta || 1); // px per ms

    // V5.2 Rules: Threshold 120px OR velocity > 0.4 px/ms
    if (diffX < -120 || (diffX < -40 && velocity > 0.4)) {
      onSwipeLeft();
    }
    
    // Reset offset with spring ease
    setDragOffset(0);
  };

  // Double tap handler
  const handleTouchStartTapCheck = (e: React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tapped!
      e.preventDefault();
      e.stopPropagation();
      onDoubleTap();
    }
    lastTapRef.current = now;
  };

  return (
    <div
      onTouchStart={(e) => {
        handleTouchStartTapCheck(e);
        handleTouchStart(e);
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-0 w-full h-full select-none"
      style={{
        touchAction: 'none',
        zIndex: 10,
      }}
    >
      {/* Visual Slider wrapper tracking swipe skip drag */}
      <div
        className={cn(
          "w-full h-full relative transition-transform",
          !isDragging && "duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
        )}
        style={{
          transform: `translateX(${dragOffset}px)`,
        }}
      >
        {children}
      </div>

      {/* Swipe next skip indicator arrow & backdrop glow */}
      {dragOffset < -10 && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-amber-500/20 to-transparent flex items-center justify-center pointer-events-none transition-opacity duration-200"
          style={{ opacity: Math.min(Math.abs(dragOffset) / 100, 1) }}
        >
          <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center shadow-lg transform translate-x-2 animate-pulse">
            <svg className="w-6 h-6 text-stone-950 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
