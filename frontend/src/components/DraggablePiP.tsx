import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../utils/index.js';

interface Props {
  className?: string;
  isDraggable?: boolean;
  pipAspectRatio?: number | null;
  onDoubleTap?: () => void;
  baseStyle?: React.CSSProperties;
  children: React.ReactNode;
}

type SizeMode = 'small' | 'medium' | 'large';

const scaleMap: Record<SizeMode, number> = {
  small: 1.0,
  medium: 1.5,
  large: 2.0,
};

export function DraggablePiP({
  className = '',
  isDraggable = true,
  pipAspectRatio = 1.33,
  onDoubleTap,
  baseStyle = {},
  children
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [snapCorner, setSnapCorner] = useState<'br' | 'bl' | 'tr' | 'tl'>(() => {
    return (localStorage.getItem('pipPosition') as any) || 'tr';
  });
  
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [sizeMode, setSizeMode] = useState<SizeMode>('small');
  
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPointer = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const isDraggingRef = useRef(isDragging);
  const dragOffsetRef = useRef(dragOffset);
  const sizeModeRef = useRef(sizeMode);
  const snapCornerRef = useRef(snapCorner);
  const pipAspectRatioRef = useRef(pipAspectRatio);

  useEffect(() => {
    isDraggingRef.current = isDragging;
    dragOffsetRef.current = dragOffset;
    sizeModeRef.current = sizeMode;
    snapCornerRef.current = snapCorner;
    pipAspectRatioRef.current = pipAspectRatio;
  }, [isDragging, dragOffset, sizeMode, snapCorner, pipAspectRatio]);

  const cycleSizeMode = useCallback(() => {
    setSizeMode(prev => {
      if (prev === 'small') return 'medium';
      if (prev === 'medium') return 'large';
      return 'small';
    });
    if (navigator.vibrate) navigator.vibrate(50);
  }, []);

  const handlePointerDown = (clientX: number, clientY: number) => {
    if (!isDraggable) return;
    setIsDragging(true);
    dragStart.current = { x: clientX - dragOffset.x, y: clientY - dragOffset.y };
    initialPointer.current = { x: clientX, y: clientY };

    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      cycleSizeMode();
    }, 500);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handlePointerDown(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) return;
    handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    e.stopPropagation();
  };

  useEffect(() => {
    const cancelLongPressIfMoved = (clientX: number, clientY: number) => {
      const dist = Math.hypot(clientX - initialPointer.current.x, clientY - initialPointer.current.y);
      if (dist > 10 && longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      cancelLongPressIfMoved(e.clientX, e.clientY);
      setDragOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        cancelLongPressIfMoved(touch.clientX, touch.clientY);
        setDragOffset({
          x: touch.clientX - dragStart.current.x,
          y: touch.clientY - dragStart.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (!isDraggingRef.current) return;
      setIsDragging(false);
      
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 640;
      const baseWidth = isMobile ? vw * 0.28 : 200;
      const pipRatio = pipAspectRatioRef.current || 1.33;
      const currentScale = scaleMap[sizeModeRef.current];
      const pipW = baseWidth * currentScale;
      const pipH = (baseWidth / pipRatio) * currentScale;
      
      let currentX = 0;
      let currentY = 0;
      
      const safeBottom = isMobile ? 198 : 100;
      const safeTop = isMobile ? (72 + 54) : (72 + 16);
      
      const currentCorner = snapCornerRef.current;
      const currentDragOffset = dragOffsetRef.current;
      
      if (currentCorner === 'br') {
        currentX = vw - 24 - pipW + currentDragOffset.x;
        currentY = vh - safeBottom - pipH + currentDragOffset.y;
      } else if (currentCorner === 'bl') {
        currentX = 24 + currentDragOffset.x;
        currentY = vh - safeBottom - pipH + currentDragOffset.y;
      } else if (currentCorner === 'tr') {
        currentX = vw - 24 - pipW + currentDragOffset.x;
        currentY = safeTop + currentDragOffset.y;
      } else if (currentCorner === 'tl') {
        currentX = 24 + currentDragOffset.x;
        currentY = safeTop + currentDragOffset.y;
      }
      
      const isLeft = currentX + pipW / 2 < vw / 2;
      const isTop = currentY + pipH / 2 < vh / 2;
      const finalCorner = isTop ? (isLeft ? 'tl' : 'tr') : (isLeft ? 'bl' : 'br');
      
      setSnapCorner(finalCorner);
      localStorage.setItem('pipPosition', finalCorner);
      
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
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const containerStyle: React.CSSProperties = {
    ...baseStyle,
    transform: isDraggable 
      ? "translate($px, $px) scale($)" 
      : "scale($)",
    transformOrigin: snapCorner === 'tl' ? 'top left' : snapCorner === 'tr' ? 'top right' : snapCorner === 'bl' ? 'bottom left' : 'bottom right'
  };
  
  // Quick fix for the interpolated string syntax in Powershell here:
  containerStyle.transform = isDraggable ? 'translate(' + dragOffset.x + 'px, ' + dragOffset.y + 'px) scale(' + scaleMap[sizeMode] + ')' : 'scale(' + scaleMap[sizeMode] + ')';

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
