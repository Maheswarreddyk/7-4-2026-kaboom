import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/index.js';

interface Props {
  className?: string;
  isDraggable?: boolean;
  pipAspectRatio?: number | null;
  onDoubleTap?: () => void;
  baseStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export function DraggablePiP({
  className = '',
  isDraggable = true,
  pipAspectRatio = 1.33,
  onDoubleTap,
  baseStyle = {},
  children
}: Props) {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [snapCorner, setSnapCorner] = useState<'br' | 'bl' | 'tr' | 'tl'>(() => {
    return (localStorage.getItem('pipPosition') as any) || 'tl';
  });
  
  const dragStart = useRef({ x: 0, y: 0 });
  const [pipScale, setPipScale] = useState(1);
  const touchStartDist = useRef<number | null>(null);
  const initialPipScale = useRef<number>(1);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isDraggable) return;
    if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      initialPipScale.current = pipScale;
    } else {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX - dragOffset.x, y: touch.clientY - dragOffset.y };
    }
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setDragOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDist.current) {
        if (e.cancelable) e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchStartDist.current;
        const newScale = Math.min(Math.max(initialPipScale.current * factor, 0.6), 2.0);
        setPipScale(newScale);
      } else if (isDragging) {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        setDragOffset({
          x: touch.clientX - dragStart.current.x,
          y: touch.clientY - dragStart.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      if (!isDragging) {
        touchStartDist.current = null;
        return;
      }
      setIsDragging(false);
      touchStartDist.current = null;
      
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 640;
      const baseWidth = isMobile ? vw * 0.28 : 200;
      const pipRatio = pipAspectRatio || 1.33;
      const pipW = baseWidth * pipScale;
      const pipH = (baseWidth / pipRatio) * pipScale;
      
      let currentX = 0;
      let currentY = 0;
      
      const safeBottom = isMobile ? 198 : 100;
      const safeTop = isMobile ? (72 + 54) : (72 + 16);
      
      if (snapCorner === 'br') {
        currentX = vw - 24 - pipW + dragOffset.x;
        currentY = vh - safeBottom - pipH + dragOffset.y;
      } else if (snapCorner === 'bl') {
        currentX = 24 + dragOffset.x;
        currentY = vh - safeBottom - pipH + dragOffset.y;
      } else if (snapCorner === 'tr') {
        currentX = vw - 24 - pipW + dragOffset.x;
        currentY = safeTop + dragOffset.y;
      } else if (snapCorner === 'tl') {
        currentX = 24 + dragOffset.x;
        currentY = safeTop + dragOffset.y;
      }
      
      const isLeft = currentX + pipW / 2 < vw / 2;
      const isTop = currentY + pipH / 2 < vh / 2;
      const finalCorner = isTop ? (isLeft ? 'tl' : 'tr') : (isLeft ? 'bl' : 'br');
      
      setSnapCorner(finalCorner);
      localStorage.setItem('pipPosition', finalCorner);
      
      // Dispatch a custom event so FloatingLayoutContext or ChatPage can re-read the layout
      window.dispatchEvent(new Event('pipPositionChanged'));
      setDragOffset({ x: 0, y: 0 });
    };

    const handleResize = () => {
      window.dispatchEvent(new Event('pipPositionChanged'));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [isDragging, dragOffset, pipScale, snapCorner, pipAspectRatio]);

  const containerStyle: React.CSSProperties = {
    ...baseStyle,
    transform: isDraggable 
      ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(${pipScale})` 
      : 'none',
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={onDoubleTap}
      className={cn(className, isDragging && 'shadow-2xl border-amber-500/30 scale-[1.03]')}
      style={containerStyle}
    >
      {children}
    </div>
  );
}
