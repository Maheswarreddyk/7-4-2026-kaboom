import { useEffect, useState } from 'react';
import { PushService } from '../services/PushService.js';
import { safeLocalStorage } from '../utils/index.js';
import { cn } from '../utils/index.js';
import { BrowserCapabilities } from '../utils/index.js';

const ROTATING_MESSAGES = [
  { icon: '🏫', text: 'Someone from your college joined.' },
  { icon: '📍', text: 'Nearby conversations are active.' },
  { icon: '🎮', text: 'Gamers are matching right now.' },
  { icon: '💬', text: 'New chats are waiting for you.' },
  { icon: '❤️', text: "Don't miss your next conversation." }
];

export function MissedConnectionsToast() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    // 1. Native Permission Check
    if (!BrowserCapabilities.supportsNotifications() || Notification.permission === 'granted') return;

    // 2. Local State Machine Check
    const permission = safeLocalStorage.getItem('kaboom_notification_permission');
    if (permission === 'granted') return;

    if (permission === 'denied') {
      const lastPrompt = parseInt(safeLocalStorage.getItem('kaboom_notification_last_prompt') || '0', 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastPrompt < sevenDays) return;
    }

    const lastPrompt = parseInt(safeLocalStorage.getItem('kaboom_notification_last_prompt') || '0', 10);
    const twelveHours = 12 * 60 * 60 * 1000;
    
    // If they just dismissed it recently, don't show
    if (Date.now() - lastPrompt < twelveHours) return;

    // We only show this to returning users (they must have seen the tutorial or have preferences)
    const hasVisited = safeLocalStorage.getItem('kaboom_tutorial_seen');
    if (!hasVisited) return;
    
    // Delay showing the toast so it doesn't interrupt initial page load
    const timer = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Rotate messages every 3 seconds
  useEffect(() => {
    if (!show || status === 'success') return;
    const interval = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % ROTATING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [show, status]);

  const handleDismiss = () => {
    safeLocalStorage.setItem('kaboom_notification_last_prompt', Date.now().toString());
    setShow(false);
  };

  const handleSubscribe = async () => {
    setLoading(true);
    safeLocalStorage.setItem('kaboom_notification_prompt_seen', 'true');
    safeLocalStorage.setItem('kaboom_notification_last_prompt', Date.now().toString());

    try {
      const subscription = await PushService.requestSubscription();
      if (subscription) {
        safeLocalStorage.setItem('kaboom_notification_permission', 'granted');
        await PushService.sendSubscriptionToBackend(subscription, null);
        setStatus('success');
        setTimeout(() => setShow(false), 3000);
      } else {
        // requestSubscription returns null on error/denied
        safeLocalStorage.setItem('kaboom_notification_permission', 'denied');
        setStatus('error');
        setTimeout(() => setShow(false), 4000);
      }
    } catch (e) {
      safeLocalStorage.setItem('kaboom_notification_permission', 'denied');
      setStatus('error');
      setTimeout(() => setShow(false), 4000);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  if (status === 'success') {
    return (
      <div className="fixed bottom-6 left-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-xl px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
            <span className="animate-bounce">🚀</span> Radar Activated!
          </span>
        </div>
      </div>
    );
  }

  const currentMsg = ROTATING_MESSAGES[msgIdx];

  return (
    <>
      <style>{`
        @keyframes subtleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-subtle-float {
          animation: subtleFloat 4s ease-in-out infinite;
        }
      `}</style>

      <div className="fixed bottom-6 left-4 sm:left-6 z-50 w-[90%] sm:w-auto max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative group overflow-hidden bg-[#0B0B0C]/90 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-subtle-float">
          
          {/* Subtle glowing background aura */}
          <div className="absolute -inset-10 bg-[radial-gradient(ellipse_at_top_left,_rgba(245,166,35,0.15)_0%,_transparent_70%)] pointer-events-none" />

          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-stone-500 hover:text-stone-300 p-1.5 rounded-full hover:bg-white/5 transition-colors z-10"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="flex gap-4 relative z-10 items-center">
            {/* Mascot Icon */}
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-[1px] shadow-[0_0_20px_rgba(245,166,35,0.2)] group-hover:shadow-[0_0_30px_rgba(245,166,35,0.4)] transition-shadow duration-500">
              <div className="w-full h-full bg-[#050505] rounded-[15px] flex items-center justify-center">
                <span className="text-2xl group-hover:animate-bounce [animation-duration:1s]">
                  {currentMsg.icon}
                </span>
              </div>
            </div>

            <div className="pr-4 flex-1">
              <div className="h-5 mb-1 overflow-hidden">
                <h4 
                  key={msgIdx} 
                  className="text-white text-sm font-black leading-tight animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {currentMsg.text}
                </h4>
              </div>
              <p className="text-stone-400 text-xs leading-relaxed mb-3 font-medium">
                Turn on radar to get pinged.
              </p>
              
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className={cn(
                  "relative w-full sm:w-auto overflow-hidden bg-white text-stone-950 px-5 py-2 rounded-xl text-xs font-black transition-all duration-300",
                  "hover:scale-[1.02] active:scale-[0.96] shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)]",
                  "disabled:opacity-50 disabled:hover:scale-100",
                  !loading && "animate-pulse [animation-duration:3s]"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-50 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? 'Connecting...' : 'Activate Radar'}
                </span>
              </button>
              
              {status === 'error' && (
                <p className="text-rose-400 text-[10px] mt-2 font-bold animate-in fade-in">
                  Please allow in browser settings.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
