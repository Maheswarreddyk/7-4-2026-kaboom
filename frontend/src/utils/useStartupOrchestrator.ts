import { useState, useEffect, useCallback, useRef } from 'react';

export type StartupState = 'INITIAL' | 'CHECKING_BACKEND' | 'FAST_READY' | 'SHOW_LOADING' | 'LONG_LOADING' | 'READY' | 'FAILED';

export interface OrchestratorResult {
  state: StartupState;
  stage: string;
  progress: number;
  bootTime: number; 
  error: boolean;
  retry: () => void;
}

export function useStartupOrchestrator(): OrchestratorResult {
  const [state, setState] = useState<StartupState>('INITIAL');
  const [stage, setStage] = useState('Loading application');
  const [progress, setProgress] = useState(10);
  const [bootTime, setBootTime] = useState(0);

  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTriggerRef = useRef(0);
  const stateRef = useRef<StartupState>('INITIAL');

  // Sync state to ref for polling closure
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setStage(data.stage || 'Ready');
        setProgress(data.progress || 100);
        return data.ready === true;
      }
    } catch (e) {
      // Network error, ignore
    }
    return false;
  }, []);

  const runOrchestrator = useCallback(() => {
    setState('CHECKING_BACKEND');
    setStage('Loading application');
    setProgress(10);
    setBootTime(0);
    startTimeRef.current = performance.now();

    let isResolved = false;

    const poll = async () => {
      if (isResolved) return;
      const ready = await checkHealth();
      const elapsedMs = performance.now() - startTimeRef.current;
      
      if (ready) {
        isResolved = true;
        
        if (elapsedMs < 300) {
          // Fast path: never show loading screen
          setState('FAST_READY');
          setTimeout(() => setState('READY'), 50); 
        } else {
          // If we showed the loading screen, make sure it was on screen for at least 700ms 
          // to prevent an ugly flicker before fading out.
          const minDisplayMs = 700;
          const remainingWait = Math.max(0, minDisplayMs - elapsedMs);
          setTimeout(() => setState('READY'), remainingWait);
        }
      } else {
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        setBootTime(elapsedSecs);

        if (elapsedSecs >= 30) {
           isResolved = true;
           // Fallback to READY to allow users to see the UI even if backend health fails
           setState('READY');
           return;
        }

        if (elapsedMs >= 2000) {
          setState('LONG_LOADING');
        } else if (elapsedMs >= 300) {
          setState('SHOW_LOADING');
        }

        intervalRef.current = setTimeout(poll, 1000);
      }
    };

    poll();
  }, [checkHealth]);

  useEffect(() => {
    runOrchestrator();
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [retryTriggerRef.current, runOrchestrator]);

  const retry = useCallback(() => {
    if (intervalRef.current) clearTimeout(intervalRef.current);
    retryTriggerRef.current += 1;
  }, []);

  return {
    state,
    stage,
    progress,
    bootTime,
    error: state === 'FAILED',
    retry
  };
}
