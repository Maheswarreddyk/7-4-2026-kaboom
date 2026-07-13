import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
import { MatchQualityWidget } from '../widgets/MatchQualityWidget.js';
import { DemandGapWidget } from '../widgets/DemandGapWidget.js';

export function Product() {
  const { token } = useAdminAuth();
  const [matchData, setMatchData] = useState([]);
  const [demandData, setDemandData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        
        const [matchRes, demandRes] = await Promise.all([
          fetch(`${API_URL}/api/analytics/match-quality`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/api/analytics/search-demand`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (matchRes.ok) {
          const json = await matchRes.json();
          setMatchData(json);
        }
        if (demandRes.ok) {
          const json = await demandRes.json();
          setDemandData(json);
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
        <h1 className="text-3xl font-bold text-white mb-2">Product Intelligence</h1>
        <p className="text-slate-400">Match quality metrics, search demand, and algorithmic performance.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <MatchQualityWidget data={matchData} />
          <DemandGapWidget data={demandData} />
        </div>
      )}
    </div>
  );
}
