import React, { useState } from 'react';
import { useAdminAuth } from '../AdminAuth.js';

export function NotificationsAdmin() {
  const { token } = useAdminAuth();
  const [template, setTemplate] = useState('campus_active');
  const [campus, setCampus] = useState('');
  const [status, setStatus] = useState('');

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

              {template === 'campus_active' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Target Campus Variable</label>
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
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
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
            <h2 className="text-lg font-semibold text-white mb-4">Performance</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Active Subs</span>
                <span className="text-white font-mono">1,204</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg CTR</span>
                <span className="text-white font-mono">14.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
