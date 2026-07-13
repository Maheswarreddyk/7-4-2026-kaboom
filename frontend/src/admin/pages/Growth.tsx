import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
import { TrendingUp, Users } from '../Icons.js';
import { FunnelWidget } from '../widgets/FunnelWidget.js';

export function Growth() {
  const { token } = useAdminAuth();
  const [funnelData, setFunnelData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_URL}/api/analytics/funnel`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setFunnelData(json);
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
        <h1 className="text-3xl font-bold text-white mb-2">Growth & Funnels</h1>
        <p className="text-slate-400">Track user acquisition, conversion, and retention metrics.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <FunnelWidget data={funnelData} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Acquisition Trends</h3>
              </div>
              <div className="h-48 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                Growth charts will be populated as more historical data is gathered.
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Retention (Day 1)</h3>
              </div>
              <div className="h-48 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                <span className="text-4xl font-bold text-white mb-2">--%</span>
                <span className="text-sm">Not enough data to calculate retention.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
