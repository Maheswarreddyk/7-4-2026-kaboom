import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAdminAuth } from './AdminAuth.js';
import { 
  BarChart3, 
  TrendingUp,
  LogOut,
  Target,
  Activity,
  Bell,
  RefreshCw
} from './Icons.js';
const API_URL = import.meta.env.VITE_API_URL || '';

interface NavCategory {
  title: string;
  items: Array<{ path: string; label: string; icon: any; exact?: boolean }>;
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    title: 'Product Analytics',
    items: [
      { path: '', label: '1. Overview', icon: BarChart3, exact: true },
      { path: 'trends', label: '2. Usage Trends', icon: TrendingUp },
      { path: 'audience', label: '3. Audience', icon: Target },
      { path: 'match-analytics', label: '4. Match Analytics', icon: Activity },
      { path: 'notifications', label: '5. Notifications', icon: Bell },
      { path: 'activity-feed', label: '6. Activity Feed', icon: Activity },
    ]
  }
];

export function AdminLayout() {
  const { logout, token } = useAdminAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/analytics/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setLastRefreshed(new Date());
        // Simple reload to refresh all sub-components
        window.location.reload();
      } else {
        alert('Failed to synchronize analytics.');
      }
    } catch (e) {
      alert('Error connecting to ETL service.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-300 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col backdrop-blur-xl">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center mr-3 shadow-lg shadow-blue-500/20">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Kaboom Analytics</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-8">
          {NAV_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h4 className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {category.title}
              </h4>
              <div className="flex flex-col gap-1">
                {category.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-600/10 text-blue-400'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5 mr-3 opacity-80" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing ETL...' : 'Refresh Analytics'}
          </button>
          
          <button
            onClick={logout}
            className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors mt-2"
          >
            <LogOut className="w-5 h-5 mr-3 opacity-80" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b border-slate-800/50 bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-10 flex items-center px-8 justify-between">
          <h1 className="text-lg font-semibold text-white">Product Dashboard</h1>
          {lastRefreshed && (
            <span className="text-xs text-slate-500">Last Synced: {lastRefreshed.toLocaleTimeString()}</span>
          )}
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
