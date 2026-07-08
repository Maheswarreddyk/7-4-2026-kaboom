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

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    const storedToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    const lifecycleRaw = localStorage.getItem('kaboom_session_lifecycle');

    let shouldRestore = false;
    if (lifecycleRaw) {
      try {
        const lifecycle: SessionLifecycle = JSON.parse(lifecycleRaw);
        const ageSecs = (Date.now() - lifecycle.timestamp) / 1000;
        if (lifecycle.state === 'CONNECTED' && ageSecs < 15) {
          shouldRestore = true;
        }
      } catch {}
    }

    // Always clear the temporary flag on boot
    localStorage.removeItem('kaboom_session_lifecycle');

    if (storedId && storedToken) {
      if (shouldRestore) {
        setIsLoading(true);
        apiService.restoreSession(storedId, storedToken)
          .then((data) => {
            setSession(data);
          })
          .catch(() => {
            localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
            localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
        localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      }
    }
  }, []);

  const startSession = useCallback(async (): Promise<SessionData> => {
    setIsLoading(true);
    try {
      const data = await apiService.startSession();
      setSession(data);
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, data.sessionId);
      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.sessionToken);
      updateSessionLifecycleState('IDLE');
      return data;
    } finally {
      setIsLoading(false);
    }
  }, [updateSessionLifecycleState]);

  const endSession = useCallback(async () => {
    if (!session) return;
    try {
      updateSessionLifecycleState('DESTROYED');
      await apiService.endSession(session.sessionId);
    } finally {
      setSession(null);
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    }
  }, [session, updateSessionLifecycleState]);

  const value = useMemo(
    () => ({
      session,
      stats,
      isLoading,
      startSession,
      endSession,
      refreshStats,
      updateSessionLifecycleState,
    }),
    [session, stats, isLoading, startSession, endSession, refreshStats, updateSessionLifecycleState]
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
