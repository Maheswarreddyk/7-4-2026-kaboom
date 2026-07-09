import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../utils/index.js';
import { DockButton } from './DockButton.js';

interface OverflowMenuProps {
  children: React.ReactNode;
  disabled?: boolean;
}

export function OverflowMenu({ children, disabled = false }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const MoreIcon = () => (
    <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  );

  return (
    <div className="relative inline-block" ref={menuRef}>
      <DockButton
        onClick={() => setOpen(!open)}
        icon={<MoreIcon />}
        active={open}
        disabled={disabled}
        tooltip="More Actions"
      />

      {open && (
        <div 
          className={cn(
            "absolute bottom-[calc(var(--control-size)+12px)] right-0 p-2.5 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col gap-2 z-50 min-w-[56px] items-center animate-spring-in pointer-events-auto"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
