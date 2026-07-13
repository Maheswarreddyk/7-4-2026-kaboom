import React from 'react';

interface WidgetCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function WidgetCard({ title, subtitle, children, className = '' }: WidgetCardProps) {
  return (
    <div className={`bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 p-6 flex flex-col ${className}`}>
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
