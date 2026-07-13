import { useEffect, useState } from 'react';
import { PushService } from '../services/PushService.js';
import { safeLocalStorage } from '../utils/index.js';

export function MissedConnectionsToast() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [college, setCollege] = useState('your college');

  useEffect(() => {
    // Only show if they have visited before and aren't subscribed
    const hasVisited = safeLocalStorage.getItem('kaboom_tutorial_seen');
    const isSubscribed = safeLocalStorage.getItem('kaboom_push_subscribed');
    const prefsRaw = safeLocalStorage.getItem('kaboom_preferences');
    
    if (hasVisited && !isSubscribed) {
      if (prefsRaw) {
        try {
          const prefs = JSON.parse(prefsRaw);
          if (prefs.college) setCollege(prefs.college);
        } catch (e) {}
      }
      
      // Delay showing the toast so it doesn't interrupt initial page load
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const subscription = await PushService.requestSubscription();
      if (subscription) {
        // We don't have sessionId on LandingPage unless we start a session, 
        // but we can still save the sub without it.
        await PushService.sendSubscriptionToBackend(subscription, null);
        setStatus('success');
        setTimeout(() => setShow(false), 3000);
      } else {
        setStatus('error');
      }
    } catch (e) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  if (status === 'success') {
    return (
      <div className="fixed bottom-6 left-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-xl px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="text-emerald-400">✅ Alerts enabled!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-4 sm:left-6 z-50 w-[90%] sm:w-auto max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="relative group overflow-hidden bg-slate-900/90 backdrop-blur-xl border border-rose-500/30 p-4 rounded-2xl shadow-2xl">
        <button 
          onClick={() => setShow(false)}
          className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 p-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="flex gap-3">
          <div className="mt-1 text-2xl animate-bounce [animation-duration:2s]">🔥</div>
          <div className="pr-4">
            <h4 className="text-white text-sm font-bold leading-tight mb-1">
              Missed Connections
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed mb-3">
              People from <strong>{college}</strong> were chatting while you were away. Turn on alerts to not miss out.
            </p>
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors w-full sm:w-auto text-center"
            >
              {loading ? 'Enabling...' : 'Turn on Alerts'}
            </button>
            {status === 'error' && (
              <p className="text-rose-400 text-[10px] mt-1.5 font-medium">Please allow in browser settings.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
