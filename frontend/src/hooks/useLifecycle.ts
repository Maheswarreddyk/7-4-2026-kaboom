import { useState, useEffect } from 'react';
import { LifecycleManager, LifecycleState } from '../services/LifecycleManager.js';

export function useLifecycle(): LifecycleState {
  const [state, setState] = useState<LifecycleState>(() => LifecycleManager.getInstance().getState());

  useEffect(() => {
    const handleStateChanged = (event: { state: LifecycleState, metadata?: any }) => {
      setState(event.state);
    };

    const manager = LifecycleManager.getInstance();
    manager.on('stateChanged', handleStateChanged);

    return () => {
      manager.off('stateChanged', handleStateChanged);
    };
  }, []);

  return state;
}
