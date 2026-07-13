import { WidgetCard } from './WidgetCard.js';
import { Globe, Monitor } from '../Icons.js';

interface LiveSession {
  id: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  status: string;
  last_activity: string;
}

interface LiveTableWidgetProps {
  data: LiveSession[];
}

export function LiveTableWidget({ data }: LiveTableWidgetProps) {
  return (
    <WidgetCard title="Live Operations" subtitle="Real-time session stream (auto-refreshes every 5s)." className="col-span-full">
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700/50">
              <th className="pb-3 font-medium">Session ID</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Location</th>
              <th className="pb-3 font-medium">Device/Browser</th>
              <th className="pb-3 font-medium text-right">Heartbeat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map((session) => {
              const lastActive = new Date(session.last_activity);
              const secondsAgo = Math.floor((Date.now() - lastActive.getTime()) / 1000);
              
              return (
                <tr key={session.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 font-mono text-xs text-slate-500">
                    {session.id.split('-')[0]}...
                  </td>
                  <td className="py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      session.status === 'active' ? 'bg-slate-700 text-slate-300' :
                      session.status === 'waiting' ? 'bg-amber-500/10 text-amber-400' :
                      session.status === 'matched' ? 'bg-emerald-500/10 text-emerald-400' :
                      'bg-rose-500/10 text-rose-400'
                    }`}>
                      {session.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      <span>{session.city || 'Unknown'}, {session.country || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Monitor className="w-3.5 h-3.5 text-slate-500" />
                      <span>{session.device || 'Desktop'} / {session.browser || 'Chrome'}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className={secondsAgo < 10 ? 'text-emerald-400' : 'text-amber-400'}>
                      {secondsAgo}s ago
                    </span>
                  </td>
                </tr>
              );
            })}
            
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                  No active sessions in the last 5 minutes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  );
}
