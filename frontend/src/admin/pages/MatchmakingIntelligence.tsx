import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
const API_URL = import.meta.env.VITE_API_URL || '';

export function MatchmakingIntelligence() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatchmaking = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics/match-analytics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch match analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatchmaking();
  }, [token]);

  if (loading) return <div className="p-8 text-slate-400">Loading match analytics...</div>;
  if (!data || Object.keys(data).length === 0) return (
    <div className="p-8 text-slate-400 border border-dashed border-slate-700 rounded-xl text-center">
      No analytics available yet. Click "Refresh Analytics" in the sidebar.
    </div>
  );

  const funnelSteps = [
    { label: 'Queue Joins', value: data.queue_joins || 0 },
    { label: 'Matched', value: data.matched || 0 },
    { label: 'Connected', value: data.connected || 0 },
    { label: 'Completed', value: data.completed || 0 },
    { label: 'Liked', value: data.liked || 0 },
    { label: 'Mutual Likes', value: data.mutual_likes || 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Match Analytics</h2>
        <p className="text-slate-400 mt-1">Funnel drop-off and call end reasons.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">User Funnel</h3>
          <div className="space-y-4">
            {funnelSteps.map((step, idx) => {
              const prev = idx === 0 ? step.value : funnelSteps[idx - 1].value;
              const dropoff = prev > 0 ? Math.round(((prev - step.value) / prev) * 100) : 0;
              const width = funnelSteps[0].value > 0 ? (step.value / funnelSteps[0].value) * 100 : 0;
              
              return (
                <div key={step.label} className="relative">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 font-medium">{step.label}</span>
                    <span className="text-slate-400">
                      {step.value} {idx > 0 && <span className="text-rose-400 text-xs ml-2">(-{dropoff}%)</span>}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${width}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Drop-off Reasons</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-300">User Skipped</span>
              <span className="text-white font-bold">{data.skipped_count || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-300">Partner Left</span>
              <span className="text-white font-bold">{data.partner_left_count || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-300">Timeout</span>
              <span className="text-white font-bold">{data.timeout_count || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-300">Connection Failed</span>
              <span className="text-white font-bold">{data.failed_negotiation_count || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
