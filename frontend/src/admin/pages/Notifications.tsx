import { useState, useEffect } from 'react';
import { useAdminAuth } from '../AdminAuth.js';

export function NotificationsAdmin() {
  const { token } = useAdminAuth();
  const [template, setTemplate] = useState('campus_active');
  const [campus, setCampus] = useState('');
  const [targetAll, setTargetAll] = useState(true);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ 
    activeSubs: 0, inactiveSubs: 0, sent: 0, clicked: 0, avgCtr: 0, 
    permissionDenied: 0, revoked: 0, dismissed: 0 
  });
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchStatsAndHistory = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const [statsRes, historyRes] = await Promise.all([
          fetch(`${API_URL}/api/admin/notifications/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/api/admin/notifications/history`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
        if (historyRes.ok) {
          setHistory(await historyRes.json());
        }
      } catch (e) {
        console.error('Failed to fetch stats/history:', e);
      }
    };
    fetchStatsAndHistory();
    // Refresh every 60 seconds
    const timer = setInterval(fetchStatsAndHistory, 60000);
    return () => clearInterval(timer);
  }, [token]);

  const handleTest = async () => {
    setStatus('Sending test...');
    try {
      const subJSONStr = localStorage.getItem('kaboom_push_subscribed_data');
      if (!subJSONStr) {
        setStatus('Error: You must enable notifications on this browser first to test.');
        return;
      }

      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/admin/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionJson: JSON.parse(subJSONStr),
          templateType: template,
          context: { campus },
          deepLink: '/'
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatus('Test sent successfully to your browser!');
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setStatus(`Failed to send test: ${e.message}`);
    }
  };

  const handleBroadcast = async () => {
    if (!targetAll && !campus) {
      setStatus('Error: Please specify a target campus.');
      return;
    }
    
    setStatus('Broadcasting campaign...');
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const campaignId = `CAMP_${Date.now()}`;
      
      const res = await fetch(`${API_URL}/api/admin/notifications/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          campaignId,
          templateType: template,
          context: { campus },
          deepLink: '/',
          audienceSegments: targetAll ? {} : { campus }
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatus(`Broadcast sent! Delivered: ${data.sent}, Failed: ${data.failed}`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setStatus(`Failed to broadcast: ${e.message}`);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Notification Center</h1>
        <p className="text-slate-400">Broadcast campaigns and manage audience engagement.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Compose Campaign</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Template</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                >
                  <option value="campus_active">Campus Active (Re-engage)</option>
                  <option value="nearby_users">Nearby Users</option>
                  <option value="gaming_night">Gaming Night</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Target Audience</label>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={targetAll} 
                      onChange={() => setTargetAll(true)} 
                      className="accent-blue-500"
                    />
                    <span className="text-slate-300 text-sm">All Subscribers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={!targetAll} 
                      onChange={() => setTargetAll(false)} 
                      className="accent-blue-500"
                    />
                    <span className="text-slate-300 text-sm">Specific Campus</span>
                  </label>
                </div>
              </div>

              {!targetAll && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Target Campus</label>
                  <input 
                    type="text"
                    value={campus}
                    onChange={e => setCampus(e.target.value)}
                    placeholder="e.g. Saveetha"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-4">
              <button 
                onClick={handleTest}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Send Test (My Browser)
              </button>
              <button 
                onClick={handleBroadcast}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Broadcast Campaign
              </button>
            </div>
            
            {status && (
              <div className="mt-4 text-sm text-blue-400">
                {status}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Device Preview</h2>
            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded flex-shrink-0 flex items-center justify-center">
                  💥
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">Kaboom</div>
                  <div className="text-slate-300 text-sm mt-1">
                    {template === 'campus_active' ? `🏫 Your university (${campus || 'Campus'}) is getting busy.` : 'New activity on Kaboom.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Audience Estimates</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Reachable</span>
                <span className="text-white font-mono text-lg">{stats.activeSubs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Est. Target Segment</span>
                <span className="text-blue-400 font-mono text-lg">{targetAll ? stats.activeSubs.toLocaleString() : Math.round(stats.activeSubs * 0.15).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Subscribers</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Active</span>
                <span className="text-emerald-400 font-mono">{stats.activeSubs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Unsubscribed</span>
                <span className="text-amber-400 font-mono">{stats.inactiveSubs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Permission Denied</span>
                <span className="text-slate-600 italic text-xs mt-1">No production data yet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Revoked</span>
                <span className="text-slate-600 italic text-xs mt-1">No production data yet</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Performance</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Sent</span>
                <span className="text-white font-mono">{stats.sent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Clicked</span>
                <span className="text-white font-mono">{stats.clicked.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg CTR</span>
                <span className="text-blue-400 font-mono">{stats.avgCtr.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dismissed</span>
                <span className="text-slate-600 italic text-xs mt-1">No production data yet</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Campaign History</h2>
            {history.length === 0 ? (
              <div className="text-slate-500 text-sm">No campaigns broadcasted yet.</div>
            ) : (
              <div className="space-y-4">
                {history.map((campaign, idx) => (
                  <div key={idx} className="border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-medium text-sm truncate pr-2">
                        {campaign.campaignId}
                      </span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(campaign.sentAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Delivered: {campaign.delivered}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
