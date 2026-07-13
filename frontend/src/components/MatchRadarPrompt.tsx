import { useState, useEffect } from 'react';
import { PushService } from '../services/PushService.js';
import { safeLocalStorage } from '../utils/index.js';

interface MatchRadarPromptProps {
  onDismiss: () => void;
  college?: string;
  lookingFor?: string;
  sessionId?: string | null;
}

export function MatchRadarPrompt({ onDismiss, sessionId }: MatchRadarPromptProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [college, setCollege] = useState<string>('');
  const [lookingFor, setLookingFor] = useState<string>('');
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // 1. Native Permission Check
    if (Notification.permission === 'granted') {
      setShouldRender(false);
      onDismiss();
      return;
    }

    // 2. Local State Machine Check
    const permission = safeLocalStorage.getItem('kaboom_notification_permission');
    if (permission === 'granted') {
      setShouldRender(false);
      onDismiss();
      return;
    }

    if (permission === 'denied') {
      const lastPrompt = parseInt(safeLocalStorage.getItem('kaboom_notification_last_prompt') || '0', 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastPrompt < sevenDays) {
        setShouldRender(false);
        onDismiss();
        return;
      }
    }

    const lastPrompt = parseInt(safeLocalStorage.getItem('kaboom_notification_last_prompt') || '0', 10);
    const twelveHours = 12 * 60 * 60 * 1000;
    if (Date.now() - lastPrompt < twelveHours) {
      setShouldRender(false);
      onDismiss();
      return;
    }

    try {
      const prefs = JSON.parse(safeLocalStorage.getItem('kaboom_preferences') || '{}');
      if (prefs.college) setCollege(prefs.college);
      if (prefs.looking_for) setLookingFor(prefs.looking_for);
    } catch (e) {}
  }, []);

  const handleDismiss = () => {
    safeLocalStorage.setItem('kaboom_notification_last_prompt', Date.now().toString());
    onDismiss();
  };

  const handleActivate = async () => {
    setLoading(true);
    safeLocalStorage.setItem('kaboom_notification_prompt_seen', 'true');
    safeLocalStorage.setItem('kaboom_notification_last_prompt', Date.now().toString());
    
    try {
      const subscription = await PushService.requestSubscription();
      if (subscription) {
        safeLocalStorage.setItem('kaboom_notification_permission', 'granted');
        await PushService.sendSubscriptionToBackend(subscription, sessionId || null);
        setStatus('success');
        setTimeout(() => onDismiss(), 2500);
      } else {
        safeLocalStorage.setItem('kaboom_notification_permission', 'denied');
        setStatus('error');
      }
    } catch (e) {
      safeLocalStorage.setItem('kaboom_notification_permission', 'denied');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const targetText = lookingFor === 'female' ? 'Girls' : lookingFor === 'male' ? 'Guys' : 'People';
  const locationText = college ? `from ${college}` : 'matching your preferences';

  if (!shouldRender) {
    return null;
  }

  if (status === 'success') {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl shadow-emerald-500/10 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-emerald-400 font-bold text-sm">Radar Activated</h3>
            <p className="text-emerald-300/70 text-xs">We'll ping you when they're online.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-in fade-in slide-in-from-top-8 duration-700">
      <div className="relative group overflow-hidden bg-slate-900/80 backdrop-blur-2xl border border-blue-500/30 p-1 rounded-2xl shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]">
        
        {/* Animated Radar Background */}
        <div className="absolute -inset-10 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent_60%)] animate-[spin_4s_linear_infinite] opacity-50" />
        
        <div className="relative bg-slate-950/90 rounded-xl p-5 overflow-hidden">
          {/* Close Button */}
          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-start gap-4">
            <div className="relative mt-1">
              {/* Radar Icon Rings */}
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping [animation-duration:2s]" />
              <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping [animation-duration:2.5s] delay-300" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 border border-white/10">
                <span className="text-xl">📡</span>
              </div>
            </div>
            
            <div className="flex-1 pr-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 uppercase tracking-wider border border-blue-500/20">
                  Queue bypass
                </span>
              </div>
              <h3 className="text-white font-bold text-sm leading-tight mb-1">
                Activate Match Radar
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-4">
                Wait times are long. Get instantly pinged the moment {targetText.toLowerCase()} {locationText} come online.
              </p>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleActivate}
                  disabled={loading}
                  className="flex-1 relative overflow-hidden bg-white text-slate-950 font-bold text-xs py-2.5 px-4 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-50 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  {loading ? 'Activating...' : 'Turn on Radar 🔔'}
                </button>
              </div>
              
              {status === 'error' && (
                <p className="text-rose-400 text-[10px] mt-2 font-medium">
                  Please allow notifications in your browser settings to use Radar.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
