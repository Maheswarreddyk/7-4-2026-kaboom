import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
import { PlatformHealthWidget } from '../widgets/PlatformHealthWidget.js';
import { FunnelWidget } from '../widgets/FunnelWidget.js';
import { DemandGapWidget } from '../widgets/DemandGapWidget.js';
import { CampusLeaderboardWidget } from '../widgets/CampusLeaderboardWidget.js';
import { MatchQualityWidget } from '../widgets/MatchQualityWidget.js';

export function Dashboard() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch all widget data from the backend APIs
        const [missionRes, funnelRes, demandRes, campusRes, matchRes] = await Promise.all([
          fetch(`${API_URL}/api/analytics/mission-control`, { headers }),
          fetch(`${API_URL}/api/analytics/funnel`, { headers }),
          fetch(`${API_URL}/api/analytics/search-demand`, { headers }),
          fetch(`${API_URL}/api/analytics/campus-leaderboard`, { headers }),
          fetch(`${API_URL}/api/analytics/match-quality`, { headers })
        ]);

        if (missionRes.ok && funnelRes.ok && demandRes.ok && campusRes.ok && matchRes.ok) {
          setData({
            mission: await missionRes.json(),
            funnel: await funnelRes.json(),
            demand: await demandRes.json(),
            campus: await campusRes.json(),
            matchQuality: await matchRes.json()
          });
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Compiling Mission Control...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-rose-400">Failed to load analytics data.</div>;
  }

  return (
    <div className="flex flex-col gap-8 max-w-7xl">
      {/* Platform Health - Category I */}
      <PlatformHealthWidget data={data.mission} />
      
      {/* Product Intelligence - Category II */}
      <MatchQualityWidget data={data.matchQuality} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CampusLeaderboardWidget data={data.campus} />
        <DemandGapWidget data={data.demand} />
      </div>

      {/* Growth - Category III */}
      <FunnelWidget data={data.funnel} />
    </div>
  );
}
