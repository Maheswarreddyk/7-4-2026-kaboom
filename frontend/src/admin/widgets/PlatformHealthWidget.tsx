import { WidgetCard } from './WidgetCard.js';
import { Activity, Users, Clock, AlertTriangle } from '../Icons.js';

interface MissionControlData {
  healthStatus: 'healthy' | 'degraded' | 'critical';
  liveUsers: number;
  activeSearches: number;
  activeConversations: number;
  todayReports: number;
  averageWaitSeconds: number;
  averageCallMinutes: number;
  mutualLikePercent: number;
  growthPercent: number;
}

interface PlatformHealthWidgetProps {
  data: MissionControlData;
}

export function PlatformHealthWidget({ data }: PlatformHealthWidgetProps) {
  const isHealthy = data.healthStatus === 'healthy';

  return (
    <WidgetCard title="Mission Control" subtitle="Live Platform KPIs" className="col-span-full">
      
      {/* Health Status Banner */}
      <div className={`mb-6 p-4 rounded-lg flex items-center justify-between border ${
        isHealthy 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
      }`}>
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
          </div>
          <span className="font-semibold tracking-wide uppercase text-sm">
            Platform {data.healthStatus}
          </span>
        </div>
        <div className="text-sm font-medium">
          {data.growthPercent > 0 ? `+${data.growthPercent}% Today's Growth` : `${data.growthPercent}% Today's Growth`}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Live Online */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-400 text-sm font-medium">Live Online</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-2xl font-bold text-white">{data.liveUsers}</span>
        </div>

        {/* KPI 2: Active Searches */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-400 text-sm font-medium">Searching Queue</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-white">{data.activeSearches}</span>
          <p className="text-xs text-slate-500 mt-1">Avg wait: {data.averageWaitSeconds}s</p>
        </div>

        {/* KPI 3: Active Conversations */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-400 text-sm font-medium">Active Calls</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-2xl font-bold text-white">{data.activeConversations}</span>
          <p className="text-xs text-slate-500 mt-1">Avg len: {data.averageCallMinutes}m</p>
        </div>

        {/* KPI 4: Reports & Health */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-400 text-sm font-medium">Today's Reports</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold text-white">{data.todayReports}</span>
          <p className="text-xs text-slate-500 mt-1">{data.mutualLikePercent}% Mutual Likes</p>
        </div>
      </div>

    </WidgetCard>
  );
}
