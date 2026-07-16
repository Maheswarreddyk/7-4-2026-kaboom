import re
import sys

def refactor():
    with open('frontend/src/hooks/useVideoChat.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    content = content.replace("import type { ChatState, ConnectionStatus, SessionStatus } from '../types/index.js';",
                              "import type { ChatState, ConnectionStatus } from '../types/index.js';\nimport { LifecycleManager, LifecycleState } from '../services/LifecycleManager.js';")

    # initialChatState
    content = re.sub(r"status: 'IDLE',\n\s*connectionStatus: 'disconnected',\n", "", content)

    # VALID_TRANSITIONS
    content = re.sub(r"const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus\[\]> = \{.*?\};\n", "", content, flags=re.DOTALL)

    # signalingStateRef
    content = content.replace("const signalingStateRef = useRef<SessionStatus>('IDLE');",
                              "const getSignalingState = () => LifecycleManager.getInstance().getState();")

    # Replace occurrences of signalingStateRef.current with getSignalingState()
    content = content.replace("signalingStateRef.current", "getSignalingState()")

    # setSignalingState implementation rewrite
    # We will just write a wrapper that calls LifecycleManager but keeps the logic that can't be in LM
    new_set_signaling = """const setSignalingState = useCallback((state: LifecycleState) => {
    // We don't use this internally anymore, we rely on LifecycleManager.
  }, []);"""
    # Actually it's better to just remove setSignalingState and replace its calls.
    # But let's first replace the big setSignalingState block with our useEffect for LM.
    
    # Let's replace the whole block of `const setSignalingState = useCallback((state: SessionStatus) => { ... }, [...]);`
    # with the useEffect.
    set_signaling_pattern = r"const setSignalingState = useCallback\(\(state: SessionStatus\) => \{.*?\n  \}, \[clearWebRTCTimeout, playConnected, playQueueJoin\]\);"
    
    use_effect_code = """
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>(LifecycleManager.getInstance().getState());

  useEffect(() => {
    const handleStateChange = ({ state, metadata }: any) => {
      setLifecycleState(state);
      
      // Auto-clear timeout on stable or ended states
      if (['CONNECTED', 'HOME', 'ENDED', 'TEARDOWN', 'QUEUEING'].includes(state)) {
        clearWebRTCTimeout();
        setChatState((prev) => ({ ...prev, reconnectCountdown: null }));
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
          reconnectIntervalRef.current = null;
        }
      }

      // Session Lifecycle Manager updates
      let lState: 'CONNECTED' | 'QUEUE' | 'IDLE' | 'LEAVING' | 'DESTROYED' = 'IDLE';
      if (state === 'CONNECTED') {
        lState = 'CONNECTED';
        playConnected(matchIdRef.current || undefined);
      } else if (['CONFIGURING', 'QUEUEING', 'MATCH_FOUND', 'NEGOTIATING', 'MEDIA_SETUP'].includes(state)) {
        lState = 'QUEUE';
        if (state === 'QUEUEING') {
          playQueueJoin('queue-session');
        }
      } else if (state === 'TEARDOWN') {
        lState = 'LEAVING';
      } else {
        lState = 'IDLE';
      }
      updateSessionLifecycleStateRef.current(lState, matchIdRef.current, partnerSessionIdRef.current);
    };

    const lm = LifecycleManager.getInstance();
    lm.on('stateChanged', handleStateChange);
    return () => {
      lm.off('stateChanged', handleStateChange);
    };
  }, [clearWebRTCTimeout, playConnected, playQueueJoin]);
"""
    content = re.sub(set_signaling_pattern, use_effect_code, content, flags=re.DOTALL)

    # Now replace individual setSignalingState calls.
    # Example: setSignalingState('MATCH_FOUND') -> LifecycleManager.getInstance().onMatchFound(...)
    # Actually, it's easier if `LifecycleManager` handles the state transitions, and `useVideoChat` just reads them.
    # We will need to do this manually or via more sophisticated regex.

    with open('frontend/src/hooks/useVideoChat.ts', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    refactor()
