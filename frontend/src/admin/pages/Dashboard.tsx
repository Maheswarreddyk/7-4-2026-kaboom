import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
const API_URL = import.meta.env.VITE_API_URL || '';
import { Users, Activity, PhoneCall, Heart, Clock } from '../Icons.js';

export function Dashboard() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics/overview`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch overview', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [token]);

  if (loading) return <div className="p-8 text-slate-400">Loading overview...</div>;
  if (!data || Object.keys(data).length === 0) return (
    <div className="p-8 text-slate-400 border border-dashed border-slate-700 rounded-xl text-center">
      No analytics available yet. Click "Refresh Analytics" in the sidebar.
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Platform Overview</h2>
        <p className="text-slate-400 mt-1">High-level snapshot of user activity and system health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Visitors */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xs font-medium text-slate-500">All Time</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.total_visitors || 0}</div>
          <div className="text-sm text-slate-400">Total Visitors</div>
        </div>

        {/* Queue Joins */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.queue_joins || 0}</div>
          <div className="text-sm text-slate-400">Queue Joins</div>
        </div>

        {/* Matches Created */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <PhoneCall className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.matches_created || 0}</div>
          <div className="text-sm text-slate-400">Matches Created</div>
        </div>

        {/* Connected Calls */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-teal-500/20 rounded-lg">
              <PhoneCall className="w-5 h-5 text-teal-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.connected_calls || 0}</div>
          <div className="text-sm text-slate-400">Connected Calls</div>
        </div>

        {/* Mutual Likes */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-500/20 rounded-lg">
              <Heart className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.mutual_likes || 0}</div>
          <div className="text-sm text-slate-400">Mutual Likes</div>
        </div>

        {/* Avg Wait */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.avg_wait_seconds || 0}s</div>
          <div className="text-sm text-slate-400">Avg Wait Time</div>
        </div>

        {/* Avg Duration */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.avg_duration_seconds || 0}s</div>
          <div className="text-sm text-slate-400">Avg Call Duration</div>
        </div>
      </div>
    </div>
  );
}
