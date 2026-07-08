import { cn } from '../utils/index.js';
import type { ConnectionStatus } from '../types/index.js';

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

export function ConnectionStatusBadge({ status, className }: ConnectionStatusBadgeProps) {
  
  // Render high-fidelity animated icons based on status
  const getBadgeStyle = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'Live Connected',
          badgeClass: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
          dot: (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )
        };
      case 'connecting':
        return {
          label: 'Searching...',
          badgeClass: 'bg-amber-500/10 border-amber-500/25 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
          dot: (
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )
        };
      case 'reconnecting':
        return {
          label: 'Reconnecting...',
          badgeClass: 'bg-blue-500/10 border-blue-500/25 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]',
          dot: (
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-40"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
          )
        };
      case 'failed':
        return {
          label: 'Failed',
          badgeClass: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
          dot: <span className="w-2 h-2 rounded-full bg-rose-500" />
        };
      case 'disconnected':
      default:
        return {
          label: 'Offline',
          badgeClass: 'bg-white/5 border-white/10 text-white/50',
          dot: <span className="w-2 h-2 rounded-full bg-white/30" />
        };
    }
  };

  const config = getBadgeStyle();

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold tracking-wide select-none backdrop-blur-md transition-all duration-300',
      config.badgeClass,
      className
    )}>
      {config.dot}
      <span>{config.label}</span>
    </div>
  );
}
