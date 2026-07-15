import React from 'react';

export function ApplicationShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0A0A0B] text-white overflow-hidden relative selection:bg-purple-500/30">
      {/* 
        This is the ultra-lightweight Application Shell.
        It mounts instantly before any heavy JS or Routing, 
        preventing white flashes and layout jumps.
      */}
      {children}
    </div>
  );
}
