import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiService } from '../services/api.js';
import type { SessionData, StatsData } from '../types/index.js';
import { STORAGE_KEYS } from '../types/index.js';

interface SessionLifecycle {
  state: 'CONNECTED' | 'QUEUE' | 'IDLE' | 'LEAVING' | 'DESTROYED';
  timestamp: number;
  matchId?: string | null;
  partnerSessionId?: string | null;
}

interface SessionContextValue {
  session: SessionData | null;
  stats: StatsData | null;
  isLoading: boolean;
  startSession: () => Promise<SessionData>;
  endSession: () => Promise<void>;
  cleanupSearchSession: () => void;
  refreshStats: () => Promise<void>;
  updateSessionLifecycleState: (state: SessionLifecycle['state'], matchId?: string | null, partnerSessionId?: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const data = await apiService.getStats();
      setStats(data);
    } catch {
      // Stats are non-critical; fail silently
    }
  }, []);

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  const updateSessionLifecycleState = useCallback((
    state: SessionLifecycle['state'],
    matchId: string | null = null,
    partnerSessionId: string | null = null
  ) => {
    const data: SessionLifecycle = {
      state,
      timestamp: Date.now(),
      matchId,
      partnerSessionId
    };
    localStorage.setItem('kaboom_session_lifecycle', JSON.stringify(data));
  }, []);

  const cleanupSearchSession = useCallback(() => {
    console.log('[Lifecycle] Cleanup Complete');
    const storedId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (storedId) {
      apiService.endSession(storedId).catch(() => {});
    }
    setSession(null);

    // Clear all temporary matchmaking/queue states and search filters
    const keysToRemove = [
      STORAGE_KEYS.SESSION_ID,
      STORAGE_KEYS.SESSION_TOKEN,
      'kaboom_session_lifecycle',
      'kaboom_gender',
      'kaboom_looking',
      'kaboom_match_mode',
      'kaboom_match_constraints',
      'kaboom_university',
      'kaboom_education_tags',
      'kaboom_interest_tags',
      'kaboom_country',
      'kaboom_city',
      'kaboom_languages',
      'kaboom_session',
      'kaboom_queue',
      'kaboom_match',
      'kaboom_partner',
      'kaboom_search_preferences',
      'kaboom_waiting',
      'kaboom_filters',
      'kaboom_match_policy',
      'kaboom_current_state'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    const storedToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    const lifecycleRaw = localStorage.getItem('kaboom_session_lifecycle');

    // Differentiate Page Refresh / Crash Recovery vs New Visit / Cold Start
    const isReload = (() => {
      try {
        const navs = window.performance.getEntriesByType('navigation');
        if (navs.length > 0) {
          const navType = (navs[0] as PerformanceNavigationTiming).type;
          return navType === 'reload';
        }
      } catch {}
      return window.performance.navigation?.type === 1; // Fallback
    })();

    const isChatPage = window.location.pathname === '/chat';

    let shouldRestore = false;
    let lifecycleState: string | undefined;
    let ageSecs = 999999;
    if (lifecycleRaw) {
      try {
        const lifecycle: SessionLifecycle = JSON.parse(lifecycleRaw);
        lifecycleState = lifecycle.state;
        ageSecs = (Date.now() - lifecycle.timestamp) / 1000;
        
        // Restore ONLY if reload/refresh on the /chat page, state was CONNECTED or QUEUE, and under 15s
        if (isReload && isChatPage && (lifecycle.state === 'CONNECTED' || lifecycle.state === 'QUEUE') && ageSecs < 15) {
          shouldRestore = true;
        }
      } catch {}
    }

    // Always clear the temporary flag on boot
    localStorage.removeItem('kaboom_session_lifecycle');

    if (storedId && storedToken) {
      if (shouldRestore) {
        setIsLoading(true);
        console.log('[Lifecycle] Refresh Detected. State:', lifecycleState);
        console.log('[Lifecycle] Session Restored');
        apiService.restoreSession(storedId, storedToken)
          .then((data) => {
            setSession(data);
          })
          .catch(() => {
            console.log('[Lifecycle] Session Destroyed (restore failed)');
            cleanupSearchSession();
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        console.log('[Lifecycle] Cold Start Detected. Destroying stale session.');
        cleanupSearchSession();
      }
    } else {
      console.log('[Lifecycle] Cold Start Detected (no session).');
      cleanupSearchSession();
    }
  }, [cleanupSearchSession]);

  const startSession = useCallback(async (): Promise<SessionData> => {
    setIsLoading(true);
    console.log('[Lifecycle] Fresh Session Started');
    try {
      // Clear previous credentials only (filters were already wiped on exit/load)
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);

      const data = await apiService.startSession();
      setSession(data);
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, data.sessionId);
      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.sessionToken);
      updateSessionLifecycleState('IDLE');
      console.log('[Lifecycle] Session Created. sessionId:', data.sessionId);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, [updateSessionLifecycleState]);

  const endSession = useCallback(async () => {
    if (!session) return;
    console.log('[Lifecycle] Session Destroyed via endSession');
    try {
      updateSessionLifecycleState('DESTROYED');
      await apiService.endSession(session.sessionId);
    } finally {
      cleanupSearchSession();
    }
  }, [session, updateSessionLifecycleState, cleanupSearchSession]);

  const value = useMemo(
    () => ({
      session,
      stats,
      isLoading,
      startSession,
      endSession,
      cleanupSearchSession,
      refreshStats,
      updateSessionLifecycleState,
    }),
    [session, stats, isLoading, startSession, endSession, cleanupSearchSession, refreshStats, updateSessionLifecycleState]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
