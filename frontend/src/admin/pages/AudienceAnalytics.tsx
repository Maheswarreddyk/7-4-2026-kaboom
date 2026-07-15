import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
const API_URL = import.meta.env.VITE_API_URL || '';
import { WidgetCard } from '../widgets/WidgetCard.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function AudienceAnalytics() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudience = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics/audience`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch audience', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAudience();
  }, [token]);

  if (loading) return <div className="p-8 text-slate-400">Loading audience...</div>;
  if (!data || data.length === 0) return (
    <div className="p-8 text-slate-400 border border-dashed border-slate-700 rounded-xl text-center">
      No analytics available yet. Click "Refresh Analytics" in the sidebar.
    </div>
  );

  const categories = Array.from(new Set(data.map(d => d.category)));

  const renderRanking = (title: string, cat: string) => {
    const subset = data.filter(d => d.category === cat).slice(0, 10);
    if (subset.length === 0) return null;

    return (
      <WidgetCard title={title}>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subset} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                width={100} 
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }}
              />
              <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </WidgetCard>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Audience Analytics</h2>
        <p className="text-slate-400 mt-1">Top demographics, locations, and technology.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map(cat => (
          <div key={cat}>
            {renderRanking(`Top ${cat.charAt(0).toUpperCase() + cat.slice(1)}s`, cat)}
          </div>
        ))}
      </div>
    </div>
  );
}
