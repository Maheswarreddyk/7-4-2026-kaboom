import React from 'react';

interface WidgetCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function WidgetCard({ title, subtitle, children, className = '' }: WidgetCardProps) {
  return (
    <div className={`bg-[#0f172a]/70 backdrop-blur-xl rounded-2xl border border-white/[0.05] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-6 flex flex-col transition-all duration-300 hover:border-white/[0.1] hover:bg-[#0f172a]/80 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
