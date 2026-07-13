import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth';
import { GraduationCap, Map, Users } from '../Icons.js';

export function CampusAnalytics() {
  const { token } = useAdminAuth();
  const [campuses, setCampuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_URL}/api/analytics/campus`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setCampuses(json.data);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Campus Analytics</h1>
        <p className="text-slate-400">Marketing & performance dashboard for partnered universities.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Saveetha Card (Featured) */}
        <div className="bg-gradient-to-br from-blue-900/50 to-indigo-900/20 border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -mr-10 -mt-10"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Saveetha University</h2>
              <p className="text-blue-300 text-sm">Primary Launch Campus</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MetricBox title="Active Now" value="142" icon={Users} />
            <MetricBox title="Avg Wait Time" value="12s" icon={Map} />
          </div>
        </div>

        {/* Dynamic List from DB */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Filter Selections (Historical)</h3>
          
          {loading ? (
            <div className="text-slate-500 text-sm">Loading campus data...</div>
          ) : campuses.length === 0 ? (
            <div className="text-slate-500 text-sm">No historical campus data yet.</div>
          ) : (
            <div className="space-y-3">
              {campuses.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-300 font-medium">{c.name}</span>
                  <span className="text-slate-400 text-sm">{c.count} selections</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ title, value, icon: Icon }: any) {
  return (
    <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
