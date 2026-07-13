import { WidgetCard } from './WidgetCard.js';
import { Activity, Clock, Heart } from '../Icons.js';

interface MatchQualityData {
  mode: string;
  users: number;
  avgWaitSec: number;
  avgDurationMin: number;
  mutualLikePct: number;
}

interface MatchQualityWidgetProps {
  data: MatchQualityData[];
}

export function MatchQualityWidget({ data }: MatchQualityWidgetProps) {
  return (
    <WidgetCard title="Match Quality Breakdown" subtitle="Performance metrics across different matchmaking algorithms." className="col-span-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        {data.map((mode) => (
          <div key={mode.mode} className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50 flex flex-col gap-4 relative overflow-hidden group hover:border-slate-600 transition-colors">
            
            {/* Mode Header */}
            <div className="flex justify-between items-center">
              <h4 className="text-xl font-bold text-white tracking-tight">{mode.mode} MATCH</h4>
              <span className="text-xs font-semibold px-2 py-1 bg-slate-800 text-slate-300 rounded-md">
                {mode.users.toLocaleString()} users
              </span>
            </div>

            {/* Metrics */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Avg Wait Time</span>
                </div>
                <span className="text-sm font-semibold text-white">{mode.avgWaitSec}s</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm">Avg Duration</span>
                </div>
                <span className="text-sm font-semibold text-white">{mode.avgDurationMin}m</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span className="text-sm">Mutual Likes</span>
                </div>
                <span className="text-sm font-semibold text-rose-400">{mode.mutualLikePct}%</span>
              </div>
            </div>

            {/* Visual Indicator Bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-slate-700 w-full">
              <div 
                className="h-full bg-gradient-to-r from-rose-500 to-orange-500"
                style={{ width: `${mode.mutualLikePct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
