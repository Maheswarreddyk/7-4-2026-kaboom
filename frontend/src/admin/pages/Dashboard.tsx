import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
import { PlatformHealthWidget } from '../widgets/PlatformHealthWidget.js';
import { LiveGraphsWidget } from '../widgets/LiveGraphsWidget.js';
import { LiveActivityFeedWidget } from '../widgets/LiveActivityFeedWidget.js';

export function Dashboard() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let missionTimer: number;

    const fetchMission = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const [missionRes, timeRes, liveRes] = await Promise.all([
          fetch(`${API_URL}/api/analytics/mission-control`, { headers }),
          fetch(`${API_URL}/api/analytics/mission-control/timeseries`, { headers }),
          fetch(`${API_URL}/api/analytics/live-sessions`, { headers })
        ]);
        
        if (missionRes.ok && timeRes.ok && liveRes.ok) {
          const missionData = await missionRes.json();
          const timeData = await timeRes.json();
          const liveData = await liveRes.json();
          
          setData({
            ...missionData,
            timeSeries: timeData,
            events: liveData.events || []
          });
        }
      } catch (err) {
        console.error('Failed to fetch mission control', err);
      }
    };

    const initialFetch = async () => {
      setLoading(true);
      await fetchMission();
      setLoading(false);
      
      missionTimer = window.setInterval(fetchMission, 5000);
    };

    initialFetch();

    return () => {
      window.clearInterval(missionTimer);
    };
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
    return <div className="text-rose-400">Failed to load mission control data.</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl pb-12">
      <PlatformHealthWidget data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LiveGraphsWidget timeSeriesData={data.timeSeries} />
        <LiveActivityFeedWidget events={data.events} />
      </div>
    </div>
  );
}
