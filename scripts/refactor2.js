const fs = require('fs');

function refactor() {
    const filepath = 'frontend/src/hooks/useVideoChat.ts';
    let content = fs.readFileSync(filepath, 'utf-8');

    // 1. State queries
    content = content.replace(/signalingStateRef\.current/g, 'LifecycleManager.getInstance().getState()');

    // 2. State transitions
    content = content.replace(/setSignalingState\('SEARCHING'\)/g, "LifecycleManager.getInstance().transitionTo('QUEUEING')");
    content = content.replace(/setSignalingState\('REQUEUEING'\)/g, "LifecycleManager.getInstance().transitionTo('QUEUEING')");
    content = content.replace(/setSignalingState\('MATCH_FOUND'\)/g, "LifecycleManager.getInstance().transitionTo('MATCH_FOUND')");
    content = content.replace(/setSignalingState\('READY'\)/g, "LifecycleManager.getInstance().transitionTo('NEGOTIATING')");
    content = content.replace(/setSignalingState\('NEGOTIATING'\)/g, "LifecycleManager.getInstance().transitionTo('NEGOTIATING')");
    content = content.replace(/setSignalingState\('ICE_CONNECTING'\)/g, "LifecycleManager.getInstance().transitionTo('MEDIA_SETUP')");
    content = content.replace(/setSignalingState\('CONNECTED'\)/g, "LifecycleManager.getInstance().transitionTo('CONNECTED')");
    content = content.replace(/setSignalingState\('PARTNER_LEFT'\)/g, "LifecycleManager.getInstance().transitionTo('TEARDOWN')");
    content = content.replace(/setSignalingState\('ENDED'\)/g, "LifecycleManager.getInstance().transitionTo('ENDED')");
    content = content.replace(/setSignalingState\('IDLE'\)/g, "LifecycleManager.getInstance().transitionTo('HOME')");
    
    // 3. Replace the `signalingStateRef` and `setSignalingState` definitions with a `useEffect`
    const pattern = /const signalingStateRef = useRef<SessionStatus>\('IDLE'\);[\s\S]*?const executePartnerLeftTeardown = useCallback\(\(msg/m;
    
    const replacement = `const [lifecycleState, setLifecycleState] = useState<LifecycleState>(LifecycleManager.getInstance().getState());

  useEffect(() => {
    const handleStateChange = ({ state }: { state: LifecycleState }) => {
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

  const executePartnerLeftTeardown = useCallback((msg`;
    
    content = content.replace(pattern, replacement);

    // 4. Remove `setSignalingState` from the dependency arrays
    content = content.replace(/,\s*setSignalingState/g, '');

    fs.writeFileSync(filepath, content, 'utf-8');
}

refactor();
