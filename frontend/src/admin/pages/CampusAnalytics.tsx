import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
import { CampusLeaderboardWidget } from '../widgets/CampusLeaderboardWidget.js';

export function CampusAnalytics() {
  const { token } = useAdminAuth();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_URL}/api/analytics/campus-leaderboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setLeaderboard(json);
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
        <h1 className="text-3xl font-bold text-white mb-2">Campus Leaderboard</h1>
        <p className="text-slate-400">Track adoption and engagement across partner universities.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <CampusLeaderboardWidget data={leaderboard} />
        </div>
      )}
    </div>
  );
}
