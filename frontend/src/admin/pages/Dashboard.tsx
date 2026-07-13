import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth';
import { Activity, Users, Clock, Video, TrendingUp, History } from '../Icons.js';

export function Dashboard() {
  const { token } = useAdminAuth();
  const [live, setLive] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [liveRes, histRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/live-overview`, { headers }),
        fetch(`${API_URL}/api/analytics/historical-overview`, { headers })
      ]);
      
      if (liveRes.ok) setLive((await liveRes.json()).data);
      if (histRes.ok) setHistory((await histRes.json()).data);
    };
    
    fetchData();
    const int = setInterval(fetchData, 5000);
    return () => clearInterval(int);
  }, [token]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Platform Overview</h1>
        <p className="text-slate-400">Hybrid real-time & historical analytics engine.</p>
      </div>

      {/* LIVE DATA SECTION */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Live Production Data</h2>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 ml-2 animate-pulse">Syncing</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Active Sessions" value={live?.liveUsers} icon={Users} source="visitor_sessions" />
          <StatCard title="Waiting in Queue" value={live?.queueSize} icon={Clock} source="waiting_queue" />
          <StatCard title="Connected Calls" value={live?.activeCalls} icon={Video} source="matches" />
        </div>
      </section>

      {/* HISTORICAL SECTION */}
      <section>
        <div className="flex items-center gap-2 mb-4 mt-8">
          <History className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Today's History</h2>
          <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 ml-2">analytics_events</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Matches" value={history?.matchesFound} icon={TrendingUp} />
          <StatCard title="Mutual Likes" value={history?.mutualLikes} icon={TrendingUp} />
          <StatCard title="Queue Joined" value={history?.queueJoined} icon={TrendingUp} />
          <StatCard title="Reports" value={history?.reports} icon={TrendingUp} color="text-rose-400" />
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, source, color = 'text-blue-400' }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <h3 className="text-3xl font-bold text-white mt-1">
            {value !== undefined ? value : '-'}
          </h3>
        </div>
        <div className={`p-3 bg-slate-800/50 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {source && (
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 border-t border-slate-800 pt-3 mt-2">
          Source: {source}
        </div>
      )}
    </div>
  );
}
