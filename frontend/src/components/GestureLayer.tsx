import React, { useRef, useState } from 'react';
import { cn } from '../utils/index.js';

interface GestureLayerProps {
  onSwipeLeft: () => void;   // Next Skip
  onSwipeDown?: () => void;   // Leave Chat
  onDoubleTap?: () => void;   // Like partner
  onLongPress?: () => void;   // Quick menu
  disabled?: boolean;        // Disable e.g. when chat is open or dragging PIP
  children?: React.ReactNode;
}

export function GestureLayer({
  onSwipeLeft,
  disabled = false,
  children,
}: GestureLayerProps) {
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Visual translations
  const [isDragging, setIsDragging] = useState(false);

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
    const diffY = touch.clientY - touchStart.current.y;

    // Only allow left-wards skip drag feedback visually
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        setDragOffset({ x: diffX, y: 0 });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStart.current.x;
    const diffY = touch.clientY - touchStart.current.y;
    const timeDelta = Date.now() - touchStart.current.time;
    const velocityX = Math.abs(diffX) / (timeDelta || 1);

    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal swipe (Left only)
      if (diffX < -120 || (diffX < -40 && velocityX > 0.4)) {
        onSwipeLeft();
      }
    }
    
    // Reset offset with spring ease
    setDragOffset({ x: 0, y: 0 });
  };

  return (
    <div
      onTouchStart={handleTouchStart}
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
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        }}
      >
        {children}
      </div>

      {/* Swipe next skip indicator arrow & backdrop glow */}
      {dragOffset.x < -10 && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-amber-500/20 to-transparent flex items-center justify-center pointer-events-none transition-opacity duration-200"
          style={{ opacity: Math.min(Math.abs(dragOffset.x) / 100, 1) }}
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
