const fs = require('fs');

function refactor() {
    const filepath = 'frontend/src/hooks/useVideoChat.ts';
    let lines = fs.readFileSync(filepath, 'utf-8').split('\n');

    // 1. Add LifecycleManager import
    let hasImport = lines.some(l => l.includes("import { LifecycleManager }"));
    if (!hasImport) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("import type { ChatState")) {
                lines.splice(i + 1, 0, "import { LifecycleManager } from '../services/LifecycleManager.js';");
                break;
            }
        }
    }

    // 2. Remove VALID_TRANSITIONS
    let startIndex = -1;
    let endIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {')) {
            startIndex = i;
        }
        if (startIndex !== -1 && i > startIndex && lines[i].includes('};')) {
            endIndex = i;
            break;
        }
    }
    
    if (startIndex !== -1 && endIndex !== -1) {
        lines.splice(startIndex, endIndex - startIndex + 1);
    }
    
    let content = lines.join('\n');

    // 3. Replace setSignalingState with LifecycleManager actions
    const pattern_set_signaling = /const setSignalingState = useCallback\(\(state: SessionStatus\) => \{[\s\S]*?\}, \[clearWebRTCTimeout, playConnected, playQueueJoin\]\);/;
    
    const new_set_signaling = `const setSignalingState = useCallback((state: SessionStatus) => {
    const lm = LifecycleManager.getInstance();
    switch (state) {
      case 'IDLE': lm.goHome(); break;
      case 'REQUESTING_MEDIA': 
      case 'MEDIA_READY': 
      case 'CONNECTING_REALTIME': 
      case 'SEARCHING': 
      case 'REQUEUEING': lm.joinQueue(); break;
      case 'MATCH_FOUND':
        // Handle in handleMatched explicitly.
        break;
      case 'READY': 
      case 'NEGOTIATING': lm.onNegotiating(); break;
      case 'ICE_CONNECTING': lm.onMediaSetup(); break;
      case 'CONNECTED': lm.onConnected(); break;
      case 'PARTNER_LEFT': lm.onPartnerLeft(); break;
      case 'ENDED': lm.goHome(); break;
    }
  }, []);`;

    content = content.replace(pattern_set_signaling, new_set_signaling);
    
    // 4. Insert a useEffect right ABOVE executePartnerLeftTeardown
    const pattern_insert_useeffect = /const executePartnerLeftTeardown = useCallback\(\(msg = 'Partner left. Finding someone new\.\.\.'\) => \{/;
    
    const new_useeffect = `// V24 Lifecycle Manager Sync
  useEffect(() => {
    const handleLMState = ({ state }: any) => {
      let mappedState: SessionStatus = 'IDLE';
      switch (state) {
        case 'HOME': mappedState = 'IDLE'; break;
        case 'CONFIGURING': mappedState = 'IDLE'; break;
        case 'QUEUEING': mappedState = 'SEARCHING'; break;
        case 'MATCH_FOUND': mappedState = 'MATCH_FOUND'; break;
        case 'NEGOTIATING': mappedState = 'NEGOTIATING'; break;
        case 'MEDIA_SETUP': mappedState = 'ICE_CONNECTING'; break;
        case 'CONNECTED': mappedState = 'CONNECTED'; break;
        case 'TEARDOWN': mappedState = 'PARTNER_LEFT'; break;
        case 'ENDED': mappedState = 'ENDED'; break;
      }
      
      const current = signalingStateRef.current;
      if (current === mappedState) return;

      const logTime = new Date().toLocaleTimeString();
      const entry = \`\${logTime} \${current} -> \${mappedState} (LM: \${state})\`;
      transitionLogRef.current.push(entry);
      if (environment.nodeEnv === 'development') {
        console.log(\`%c[FSM LOG] \${entry}\`, 'color: #f59e0b; font-weight: bold;');
      }

      signalingStateRef.current = mappedState;
      setChatState(prev => ({ ...prev, status: mappedState }));

      // Clear timeouts on stable states
      if (['CONNECTED', 'IDLE', 'ENDED', 'PARTNER_LEFT', 'REQUEUEING'].includes(mappedState)) {
        clearWebRTCTimeout();
        setChatState(prev => ({ ...prev, reconnectCountdown: null }));
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
          reconnectIntervalRef.current = null;
        }
      }

      let lifecycleState: 'CONNECTED' | 'QUEUE' | 'IDLE' | 'LEAVING' | 'DESTROYED' = 'IDLE';
      if (mappedState === 'CONNECTED') {
        lifecycleState = 'CONNECTED';
        playConnected(matchIdRef.current || undefined);
      } else if (['SEARCHING', 'MATCH_FOUND', 'NEGOTIATING', 'ICE_CONNECTING'].includes(mappedState)) {
        lifecycleState = 'QUEUE';
      } else if (mappedState === 'PARTNER_LEFT' || mappedState === 'ENDED') {
        lifecycleState = 'LEAVING';
      } else {
        lifecycleState = 'IDLE';
      }
      
      // Removed unused CONNECTING_REALTIME check that was causing TS errors
      if (mappedState === 'SEARCHING' && current !== 'REQUEUEING' && current !== 'SEARCHING') {
        playQueueJoin('queue-session');
      }
      
      updateSessionLifecycleStateRef.current(lifecycleState, matchIdRef.current, partnerSessionIdRef.current);
    };

    const lm = LifecycleManager.getInstance();
    lm.on('stateChanged', handleLMState);
    return () => {
      lm.off('stateChanged', handleLMState);
    };
  }, [clearWebRTCTimeout, playConnected, playQueueJoin]);

  const executePartnerLeftTeardown = useCallback((msg = 'Partner left. Finding someone new...') => {`;

    content = content.replace(pattern_insert_useeffect, new_useeffect);
    
    // 5. Replace direct usages of setSignalingState('MATCH_FOUND') because LM requires arguments
    content = content.replace(/setSignalingState\('MATCH_FOUND'\);/g, "LifecycleManager.getInstance().onMatchFound({ matchId: data.matchId, partnerSessionId: data.partnerSessionId, isInitiator: data.isInitiator });");

    fs.writeFileSync(filepath, content, 'utf-8');
}

refactor();
