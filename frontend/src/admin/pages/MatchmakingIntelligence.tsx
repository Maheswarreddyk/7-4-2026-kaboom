import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
import { WidgetCard } from '../widgets/WidgetCard.js';

export function MatchmakingIntelligence() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatchmaking = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_URL}/api/analytics/matchmaking`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatchmaking();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Compiling Matchmaking Intelligence...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-rose-400">Failed to load data.</div>;

  return (
    <div className="flex flex-col gap-6 max-w-7xl pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">Matchmaking Intelligence</h2>
      </div>

      <WidgetCard title="Wait Times" subtitle="Last 10,000 matches">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 text-center">
            <span className="block text-slate-400 text-sm font-medium mb-1">Average Wait</span>
            <span className="text-3xl font-bold text-emerald-400">{data.avgWait}s</span>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 text-center">
            <span className="block text-slate-400 text-sm font-medium mb-1">Median Wait (P50)</span>
            <span className="text-3xl font-bold text-blue-400">{data.medianWait}s</span>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 text-center">
            <span className="block text-slate-400 text-sm font-medium mb-1">95th Percentile (P95)</span>
            <span className="text-3xl font-bold text-rose-400">{data.p95Wait}s</span>
          </div>
        </div>
      </WidgetCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <WidgetCard title="Call Duration">
          <div className="mt-4 text-center">
            <span className="text-4xl font-bold text-white">{data.avgDuration}</span>
            <span className="text-slate-400 ml-1">min</span>
          </div>
        </WidgetCard>

        <WidgetCard title="Queue Abandonment">
          <div className="mt-4 text-center">
            <span className="text-4xl font-bold text-amber-400">{data.queueAbandonment}%</span>
            <span className="block text-xs text-slate-500 mt-1">Users leaving queue before match</span>
          </div>
        </WidgetCard>

        <WidgetCard title="Connection Success">
          <div className="mt-4 text-center">
            <span className="text-4xl font-bold text-emerald-400">{data.connectionSuccess}%</span>
            <span className="block text-xs text-slate-500 mt-1">Matched &gt; Connected</span>
          </div>
        </WidgetCard>

        <WidgetCard title="Partner Disconnects">
          <div className="mt-4 text-center">
            <span className="text-4xl font-bold text-rose-400">{data.partnerDisconnects}</span>
            <span className="block text-xs text-slate-500 mt-1">Calls ended due to connection drop</span>
          </div>
        </WidgetCard>
      </div>

      <WidgetCard title="Match Resolution Type" subtitle="Exact vs Smart vs Quick">
        <div className="h-32 flex items-center justify-center text-slate-500 italic text-sm border border-dashed border-slate-700 rounded-lg mt-4">
          No production data available yet (missing resolution payload in analytics_events)
        </div>
      </WidgetCard>
    </div>
  );
}
