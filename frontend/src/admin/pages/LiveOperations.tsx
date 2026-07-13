import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
import { LiveTableWidget } from '../widgets/LiveTableWidget.js';

export function LiveOperations() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_URL}/api/analytics/live-sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchLive();
    // Auto refresh every 5 seconds per Phase 4 spec
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="flex flex-col gap-8 max-w-7xl">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Operations Center</h2>
        <p className="text-slate-400 mt-1">Live monitoring of user sessions and matchmaking queues.</p>
      </div>
      
      <LiveTableWidget data={data || []} />
    </div>
  );
}
