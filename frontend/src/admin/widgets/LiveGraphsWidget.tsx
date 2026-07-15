import { WidgetCard } from './WidgetCard.js';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function LiveGraphsWidget({ timeSeriesData }: { timeSeriesData: any[] }) {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return (
      <WidgetCard title="Live Queue & Connections" subtitle="Last 60 Minutes">
        <div className="h-64 flex items-center justify-center text-slate-500">
          Waiting for activity...
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Live Queue & Connections" subtitle="Last 60 Minutes" className="col-span-2">
      <div className="h-64 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorConn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px' }}
              itemStyle={{ color: '#E2E8F0' }}
            />
            <Area type="monotone" dataKey="queueDepth" name="Queue Depth" stroke="#10B981" fillOpacity={1} fill="url(#colorQueue)" />
            <Area type="monotone" dataKey="connections" name="Connections" stroke="#3B82F6" fillOpacity={1} fill="url(#colorConn)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
