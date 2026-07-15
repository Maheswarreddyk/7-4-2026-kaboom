import { useEffect, useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';
const API_URL = import.meta.env.VITE_API_URL || '';
import { Bell } from '../Icons.js';

export function NotificationsAdmin() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics/notifications`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [token]);

  if (loading) return <div className="p-8 text-slate-400">Loading notifications...</div>;
  if (!data || Object.keys(data).length === 0) return (
    <div className="p-8 text-slate-400 border border-dashed border-slate-700 rounded-xl text-center">
      No analytics available yet. Click "Refresh Analytics" in the sidebar.
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Notifications Center</h2>
        <p className="text-slate-400 mt-1">Push subscriber metrics and campaign effectiveness.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Subs */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{data.total_subscribers || 0}</div>
          <div className="text-sm text-slate-400">Total Subscribers</div>
        </div>

        {/* Campaigns Sent */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="text-3xl font-bold text-white mb-1">{data.campaigns_sent || 0}</div>
          <div className="text-sm text-slate-400">Campaigns Sent</div>
        </div>

        {/* Delivered */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="text-3xl font-bold text-white mb-1">{data.messages_delivered || 0}</div>
          <div className="text-sm text-slate-400">Messages Delivered</div>
        </div>

        {/* Clicked */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="text-3xl font-bold text-white mb-1">{data.messages_clicked || 0}</div>
          <div className="text-sm text-slate-400">Messages Clicked</div>
        </div>
      </div>
      
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Platform Breakdown</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
            <span className="text-slate-300">Android</span>
            <span className="text-white font-bold">{data.android_subscribers || 0}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
            <span className="text-slate-300">iOS</span>
            <span className="text-white font-bold">{data.ios_subscribers || 0}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
            <span className="text-slate-300">Desktop / Browsers</span>
            <span className="text-white font-bold">
              {(data.desktop_subscribers || 0) + (data.chrome_subscribers || 0) + (data.safari_subscribers || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
