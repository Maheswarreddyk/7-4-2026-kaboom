import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
const API_URL = import.meta.env.VITE_API_URL || '';


export function ActivityFeed() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics/live-feed`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch activity feed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [token]);

  if (loading) return <div className="p-8 text-slate-400">Loading activity feed...</div>;
  if (!data || data.length === 0) return (
    <div className="p-8 text-slate-400 border border-dashed border-slate-700 rounded-xl text-center">
      No analytics available yet. Click "Refresh Analytics" in the sidebar.
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Activity Feed</h2>
        <p className="text-slate-400 mt-1">Latest significant events processed by the ETL.</p>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/50">
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="py-3 px-4">Time</th>
              <th className="py-3 px-4">Event Type</th>
              <th className="py-3 px-4">Session ID</th>
              <th className="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {data.map((event: any) => (
              <tr key={event.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="py-3 px-4">{new Date(event.created_at).toLocaleTimeString()}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    event.event_type === 'QUEUE_JOINED' ? 'bg-indigo-500/20 text-indigo-400' :
                    event.event_type === 'CALL_CONNECTED' ? 'bg-teal-500/20 text-teal-400' :
                    event.event_type === 'MUTUAL_LIKE' ? 'bg-rose-500/20 text-rose-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {event.event_type}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-xs">{event.session_id?.substring(0,8)}...</td>
                <td className="py-3 px-4 font-mono text-xs opacity-60">
                  {JSON.stringify(event.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
