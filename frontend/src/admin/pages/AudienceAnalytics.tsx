import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
import { WidgetCard } from '../widgets/WidgetCard.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export function AudienceAnalytics() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudience = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_URL}/api/analytics/audience`, {
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
    fetchAudience();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Compiling Audience Demographics...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-rose-400">Failed to load data.</div>;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

  const renderBarChart = (title: string, payload: any[]) => (
    <WidgetCard title={title}>
      <div className="h-64 mt-4">
        {payload && payload.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={payload} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#1E293B' }} contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px' }} itemStyle={{ color: '#E2E8F0' }} />
              <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 italic text-sm border border-dashed border-slate-700 rounded-lg">No production data available yet</div>
        )}
      </div>
    </WidgetCard>
  );

  const renderPieChart = (title: string, payload: any[]) => (
    <WidgetCard title={title}>
      <div className="h-64 mt-4">
        {payload && payload.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={payload} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {payload.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px' }} itemStyle={{ color: '#E2E8F0' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 italic text-sm border border-dashed border-slate-700 rounded-lg">No production data available yet</div>
        )}
      </div>
      {payload && payload.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {payload.map((entry, index) => (
            <div key={entry.name} className="flex items-center text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              {entry.name} ({entry.value})
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">Audience Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderBarChart('Top Countries', data.countries)}
        {renderBarChart('Top States', data.states)}
        {renderBarChart('Top Cities', data.cities)}
        
        {renderBarChart('Top Colleges/Campuses', data.colleges)}
        {renderBarChart('Top Interests', data.interests)}
        {renderBarChart('Top Languages', data.languages)}

        {renderPieChart('Browsers', data.browsers)}
        {renderPieChart('Operating Systems', data.os)}
        {renderPieChart('Devices', data.devices)}
        
        {renderPieChart('Screen Sizes', data.screenSizes)}
        {renderPieChart('New vs Returning Users', data.userTypes)}
      </div>
    </div>
  );
}
