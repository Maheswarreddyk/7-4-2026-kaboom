import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
const API_URL = import.meta.env.VITE_API_URL || '';

export function UsageTrends() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics/trends`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch trends', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [token]);

  if (loading) return <div className="p-8 text-slate-400">Loading trends...</div>;
  if (!data || (!data.hourly?.length && !data.daily?.length)) return (
    <div className="p-8 text-slate-400 border border-dashed border-slate-700 rounded-xl text-center">
      No analytics available yet. Click "Refresh Analytics" in the sidebar.
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">Usage Trends</h2>
        <p className="text-slate-400 mt-1">Hourly and Daily historical usage.</p>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Last 24 Hours</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-3 px-4">Hour</th>
                <th className="py-3 px-4">Visitors</th>
                <th className="py-3 px-4">Queue Joins</th>
                <th className="py-3 px-4">Connections</th>
              </tr>
            </thead>
            <tbody>
              {data.hourly?.map((row: any) => (
                <tr key={row.hour_timestamp} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="py-3 px-4">{new Date(row.hour_timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                  <td className="py-3 px-4">{row.visitors}</td>
                  <td className="py-3 px-4">{row.queue_joins}</td>
                  <td className="py-3 px-4">{row.connections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Last 30 Days</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Visitors</th>
                <th className="py-3 px-4">Queue Joins</th>
                <th className="py-3 px-4">Connections</th>
              </tr>
            </thead>
            <tbody>
              {data.daily?.map((row: any) => (
                <tr key={row.date_timestamp} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="py-3 px-4">{row.date_timestamp}</td>
                  <td className="py-3 px-4">{row.visitors}</td>
                  <td className="py-3 px-4">{row.queue_joins}</td>
                  <td className="py-3 px-4">{row.connections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
