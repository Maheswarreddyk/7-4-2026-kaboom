import re
import os

def refactor():
    filepath = 'frontend/src/hooks/useVideoChat.ts'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. State queries
    content = content.replace('signalingStateRef.current', 'LifecycleManager.getInstance().getState()')

    # 2. State transitions
    # We will remove `setSignalingState` entirely later, but first replace its usages.
    content = content.replace("setSignalingState('SEARCHING')", "LifecycleManager.getInstance().transitionTo('QUEUEING')")
    content = content.replace("setSignalingState('REQUEUEING')", "LifecycleManager.getInstance().transitionTo('QUEUEING')")
    content = content.replace("setSignalingState('MATCH_FOUND')", "LifecycleManager.getInstance().transitionTo('MATCH_FOUND')")
    content = content.replace("setSignalingState('READY')", "LifecycleManager.getInstance().transitionTo('NEGOTIATING')")
    content = content.replace("setSignalingState('NEGOTIATING')", "LifecycleManager.getInstance().transitionTo('NEGOTIATING')")
    content = content.replace("setSignalingState('ICE_CONNECTING')", "LifecycleManager.getInstance().transitionTo('MEDIA_SETUP')")
    content = content.replace("setSignalingState('CONNECTED')", "LifecycleManager.getInstance().transitionTo('CONNECTED')")
    content = content.replace("setSignalingState('PARTNER_LEFT')", "LifecycleManager.getInstance().transitionTo('TEARDOWN')")
    content = content.replace("setSignalingState('ENDED')", "LifecycleManager.getInstance().transitionTo('ENDED')")
    content = content.replace("setSignalingState('IDLE')", "LifecycleManager.getInstance().transitionTo('HOME')")
    
    # Other places where setSignalingState is used dynamically (if any)
    # Usually it's statically typed.

    # 3. Replace the `signalingStateRef` and `setSignalingState` definitions with a `useEffect`
    # We will search for `const signalingStateRef = useRef<SessionStatus>('IDLE');`
    # up to `const executePartnerLeftTeardown`
    
    pattern = r"const signalingStateRef = useRef<SessionStatus>\('IDLE'\);.*?const executePartnerLeftTeardown = useCallback\(\(msg"
    
    replacement = """const [lifecycleState, setLifecycleState] = useState<LifecycleState>(LifecycleManager.getInstance().getState());

  useEffect(() => {
    const handleStateChange = (state: LifecycleState) => {
      setLifecycleState(state);
      
      if (['CONNECTED', 'HOME', 'ENDED', 'TEARDOWN', 'QUEUEING'].includes(state)) {
        clearWebRTCTimeout();
        setChatState((prev) => ({ ...prev, reconnectCountdown: null }));
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
          reconnectIntervalRef.current = null;
        }
      }

      if (state === 'CONNECTED') {
        playConnected(matchIdRef.current || undefined);
      } else if (state === 'QUEUEING') {
        playQueueJoin('queue-session');
      }
      
      updateSessionLifecycleStateRef.current(state, matchIdRef.current, partnerSessionIdRef.current);
    };

    const lm = LifecycleManager.getInstance();
    lm.on('stateChanged', handleStateChange);
    return () => {
      lm.off('stateChanged', handleStateChange);
    };
  }, [clearWebRTCTimeout, playConnected, playQueueJoin]);

  const executePartnerLeftTeardown = useCallback((msg"""
    
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    # 4. Remove `setSignalingState` from the dependency arrays
    content = re.sub(r",\s*setSignalingState", "", content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    refactor()
