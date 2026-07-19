import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext.js';
import { useSession } from '../contexts/SessionContext.js';
import { apiService } from '../services/api.js';
import { TimelineTelemetry } from '../services/TimelineTelemetry.js';
import { realtimeManager } from '../services/realtime.js';
import { webrtcManager } from '../webrtc/index.js';
import type { ChatState, ConnectionStatus, SessionStatus } from '../types/index.js';
import { LifecycleManager } from '../services/LifecycleManager.js';
import { environment } from 'config';
import { safeLocalStorage } from '../utils/index.js';
import { useAudioUX } from './useAudioUX.js';

const initialChatState: ChatState = {
  status: 'IDLE',
  connectionStatus: 'disconnected',
  partnerSessionId: null,
  isMuted: false,
  isCameraOff: false,
  isFullscreen: false,
  matchStartTime: null,
  queuePosition: 0,
  connectionQuality: null,
  partnerSkipPending: false,
  reconnectCountdown: null,
};


export function useVideoChat(
  sessionId: string | null,
  sessionToken: string | null,
  onReaction?: (emoji: string, fromLocal: boolean) => void
) {
  const { showToast } = useToast();
  const { updateSessionLifecycleState } = useSession();
  const { playQueueJoin, playConnected } = useAudioUX();
  const [chatState, setChatState] = useState<ChatState>(initialChatState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const isQueuePausedRef = useRef(false);
  const setQueuePaused = useCallback((paused: boolean) => {
    setIsQueuePaused(paused);
    isQueuePausedRef.current = paused;
  }, []);
  const partnerSessionIdRef = useRef<string | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const callbacksRef = useRef<ReturnType<typeof buildCallbacks> | null>(null);
  const offerRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipInProgressRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Phase 3: Refs for WebRTC signaling message deduplication
  const lastProcessedOfferSdpRef = useRef<string | null>(null);
  const lastProcessedAnswerSdpRef = useRef<string | null>(null);
  
  // Phase 2: Ref to prevent stale closures in callbacks (specifically onOffer collision logic)
  const isInitiatorRef = useRef<boolean>(false);

  // V6.15: Refs for debug transition logging, deduplication, and active call heartbeat
  const processedEventsRef = useRef<Set<string>>(new Set());
  const transitionLogRef = useRef<string[]>([]);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeHeartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hardening Phase D: Refs for stalled video track detection
  const lastFramesDecodedRef = useRef<number>(0);
  const stalledCountRef = useRef<number>(0);

  // Hardening Phase A2: Timer Refs to prevent zombie reconnection loops
  const partnerLeftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rejoinRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hardening Phase A2: Latest-Value Refs to prevent stale closures in signaling callbacks
  const onReactionRef = useRef(onReaction);
  const handleMatchedRef = useRef<any>(null);
  const handleStartNegotiationRef = useRef<any>(null);
  const executePartnerLeftTeardownRef = useRef<any>(null);
  const startReconnectCountdownRef = useRef<any>(null);
  const startChatRef = useRef<any>(null);
  const updateSessionLifecycleStateRef = useRef<any>(null);
  const handleNextRef = useRef<(reason?: 'next' | 'reported' | 'error' | 'timeout') => Promise<void>>(async () => {});

  useEffect(() => {
    onReactionRef.current = onReaction;
    handleMatchedRef.current = handleMatched;
    handleStartNegotiationRef.current = handleStartNegotiation;
    executePartnerLeftTeardownRef.current = executePartnerLeftTeardown;
    startReconnectCountdownRef.current = startReconnectCountdown;
    startChatRef.current = startChat;
    updateSessionLifecycleStateRef.current = updateSessionLifecycleState;
  });




  const triggerAutoRejoinRef = useRef<() => Promise<void>>(async () => {});
  const webrtcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateChatState = useCallback((updates: Partial<ChatState>) => {
    setChatState((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearWebRTCTimeout = useCallback(() => {
    if (webrtcTimeoutRef.current) {
      clearTimeout(webrtcTimeoutRef.current);
      webrtcTimeoutRef.current = null;
    }
  }, []);

  const startWebRTCTimeout = useCallback(() => {
    clearWebRTCTimeout();
    webrtcTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      const state = LifecycleManager.getInstance().getState();
      if (state !== 'CONNECTED' && state !== ('IDLE' as any) && state !== 'ENDED') {
        console.warn(`[WebRTC Timeout] Connection did not establish within 15s (current status: ${state}). Tearing down match...`);
        executePartnerLeftTeardownRef.current?.('Connection timed out. Finding someone else...');
      }
    }, 15000); // 15s timeout (V4.1 Requirement 14)
  }, [clearWebRTCTimeout]);

  const setSignalingState = useCallback((state: SessionStatus) => {
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
  }, []);

  // Polling fallback to check if we missed a Realtime broadcast (FE-001 fix)
  useEffect(() => {
    let interval: any = null;
    if (chatState.status === 'SEARCHING' && sessionIdRef.current && sessionTokenRef.current) {
      interval = setInterval(async () => {
        try {
          const status = await apiService.getMatchStatus(sessionIdRef.current!, sessionTokenRef.current!);
          if (status?.status === 'matched') {
            console.log('[Polling Fallback] Found missed match from backend!', status);
            const lm = LifecycleManager.getInstance();
            if (lm.getState() === 'QUEUEING') {
              lm.onMatchFound(status);
            }
          }
        } catch (err) {
          // Ignore polling errors
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [chatState.status]);

  // V24 Lifecycle Manager Sync
  useEffect(() => {
    const handleLMState = ({ state, metadata }: any) => {
      let mappedState: SessionStatus = 'IDLE';
      switch (state) {
        case 'HOME': mappedState = 'IDLE'; break;
        case 'CONFIGURING': mappedState = 'IDLE'; break;
        case 'QUEUEING': mappedState = 'SEARCHING'; break;
        case 'MATCH_FOUND': mappedState = 'MATCH_FOUND'; break;
        case 'NEGOTIATING': mappedState = 'NEGOTIATING'; break;
        case 'AWAITING_MEDIA': mappedState = 'ICE_CONNECTING'; break;
        case 'CONNECTED': mappedState = 'CONNECTED'; break;
        case 'TEARDOWN': 
          mappedState = metadata?.reason === 'local_skip' ? 'REQUEUEING' : 'PARTNER_LEFT';
          if (metadata?.reason === 'local_skip') {
             void handleNextRef.current();
          }
          break;
        case 'ENDED': mappedState = 'ENDED'; break;
      }
      
      const current = LifecycleManager.getInstance().getState();
      if (current === mappedState) return;

      const logTime = new Date().toLocaleTimeString();
      const entry = `${logTime} ${current} -> ${mappedState} (LM: ${state})`;
      transitionLogRef.current.push(entry);
      if (environment.nodeEnv === 'development') {
        console.log(`%c[FSM LOG] ${entry}`, 'color: #f59e0b; font-weight: bold;');
      }

      
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
      if (mappedState === ('SEARCHING' as any) && current !== ('REQUEUEING' as any) && current !== ('SEARCHING' as any)) {
        playQueueJoin('queue-session');
      }
      
      updateSessionLifecycleStateRef.current(lifecycleState, matchIdRef.current, partnerSessionIdRef.current);
    };

    const lm = LifecycleManager.getInstance();
    lm.on('stateChanged', handleLMState);
    const handleAbortMatch = ({ matchId }: { matchId: string }) => {
      console.log(`[useVideoChat] Forwarding abortMatch to backend for match ${matchId}`);
      realtimeManager.sendAbortMatch(matchId);
    };
    lm.on('abortMatch', handleAbortMatch);
    return () => {
      lm.off('stateChanged', handleLMState);
      lm.off('abortMatch', handleAbortMatch);
    };
  }, [clearWebRTCTimeout, playConnected, playQueueJoin]);

  const executePartnerLeftTeardown = useCallback((msg = 'Partner left. Finding someone new...') => {
    setSignalingState('PARTNER_LEFT');
    updateChatState({ partnerSkipPending: false }); // V24 clear banner
    webrtcManager.resetConnection();
    lastProcessedOfferSdpRef.current = null;
    lastProcessedAnswerSdpRef.current = null;
    matchIdRef.current = null;
    
    showToast('info', msg);
    // Wait 2.5 seconds to show the left animation overlay, then automatically rejoin the queue
    if (partnerLeftTimeoutRef.current) clearTimeout(partnerLeftTimeoutRef.current);
    partnerLeftTimeoutRef.current = setTimeout(() => {
      void triggerAutoRejoinRef.current();
    }, 2500);
  }, [showToast]);

  const startReconnectCountdown = useCallback(() => {
    if (reconnectIntervalRef.current) return; // Already counting down

    if (partnerReconnectTimerRef.current) clearTimeout(partnerReconnectTimerRef.current);
    
    updateChatState({ connectionStatus: 'reconnecting', reconnectCountdown: 5 });

    let count = 5;
    reconnectIntervalRef.current = setInterval(() => {
      count -= 1;
      console.log(`[Grace Period Countdown] ${count}s remaining...`);
      updateChatState({ reconnectCountdown: count });

      if (count <= 0) {
        console.log('[Grace Period] Reconnect countdown expired. Invoking Next Partner flow...');
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
          reconnectIntervalRef.current = null;
        }
        void handleNextRef.current('error');
      }
    }, 1000);

    // Backup timer to ensure execution happens even if setInterval drifts
    partnerReconnectTimerRef.current = setTimeout(() => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      void handleNextRef.current('error');
    }, 5500);
  }, [updateChatState]);

  sessionIdRef.current = sessionId;
  sessionTokenRef.current = sessionToken;

  const clearSignalingRetryTimers = useCallback(() => {
    if (offerRetryTimerRef.current) {
      clearInterval(offerRetryTimerRef.current);
      offerRetryTimerRef.current = null;
    }
    if (answerRetryTimerRef.current) {
      clearInterval(answerRetryTimerRef.current);
      answerRetryTimerRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearSignalingRetryTimers();
    clearWebRTCTimeout();
    if (partnerReconnectTimerRef.current) {
      clearTimeout(partnerReconnectTimerRef.current);
      partnerReconnectTimerRef.current = null;
    }
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
    if (partnerLeftTimeoutRef.current) {
      clearTimeout(partnerLeftTimeoutRef.current);
      partnerLeftTimeoutRef.current = null;
    }
    if (rejoinRetryTimeoutRef.current) {
      clearTimeout(rejoinRetryTimeoutRef.current);
      rejoinRetryTimeoutRef.current = null;
    }
    if (connectRetryTimeoutRef.current) {
      clearTimeout(connectRetryTimeoutRef.current);
      connectRetryTimeoutRef.current = null;
    }
    // P1 Fix: Also clear the active-call heartbeat to prevent ghost sessions
    // leaking into the matchmaker after the user has left.
    if (activeHeartbeatIntervalRef.current) {
      clearInterval(activeHeartbeatIntervalRef.current);
      activeHeartbeatIntervalRef.current = null;
    }
  }, [clearSignalingRetryTimers, clearWebRTCTimeout]);

  const handleIceRestart = useCallback(async () => {
    if (!isInitiatorRef.current) {
      console.log('[WebRTC] Not the initiator. Skipping ICE restart to avoid glare collision.');
      return;
    }
    try {
      console.log('[WebRTC] Initiating ICE restart...');
      const offer = await webrtcManager.createOffer({ iceRestart: true });
      if (sessionIdRef.current && matchIdRef.current && callbacksRef.current) {
        
        // Phase 4: WebRTC Hardening — Verify WebSocket is connected before sending offer
        await realtimeManager.ensureMatchChannelConnected(matchIdRef.current, callbacksRef.current);
        
        realtimeManager.sendOffer(sessionIdRef.current, offer);

        if (offerRetryTimerRef.current) clearInterval(offerRetryTimerRef.current);
        offerRetryTimerRef.current = setInterval(() => {
          console.log('[Signaling] ICE restart Offer ACK not received, retrying...');
          if (sessionIdRef.current) {
            realtimeManager.sendOffer(sessionIdRef.current, offer);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('[WebRTC] ICE restart failed:', err);
    }
  }, []);

  const setupWebRTC = useCallback(async () => {
    // Reset media check timeout if any exists
    if (webrtcTimeoutRef.current) {
      clearTimeout(webrtcTimeoutRef.current);
      webrtcTimeoutRef.current = null;
    }
    const mediaCheckTimeoutRef = { current: null as any };

    const checkAndSetConnected = async () => {
      
      if (!isMountedRef.current || LifecycleManager.getInstance().getState() !== 'AWAITING_MEDIA') {
        if (mediaCheckTimeoutRef.current) clearTimeout(mediaCheckTimeoutRef.current);
        return;
      }
      const isIceConnected = webrtcManager.getConnectionState() === 'connected';
      if (!isIceConnected) {
        TimelineTelemetry.log('SyncGate', 'ICE disconnected', { state: webrtcManager.getConnectionState() });
        console.warn(`[Sync Gate] Blocked CONNECTED transition. ICE: ${webrtcManager.getConnectionState()}`);
        if (mediaCheckTimeoutRef.current) clearTimeout(mediaCheckTimeoutRef.current);
        return;
      }

      const remoteStream = webrtcManager.getRemoteStream();
      const audioTracks = remoteStream ? remoteStream.getAudioTracks() : [];
      const videoTracks = remoteStream ? remoteStream.getVideoTracks() : [];
      
      const hasRemoteAudio = audioTracks.length > 0 && audioTracks[0].readyState === 'live';
      const hasRemoteVideo = videoTracks.length > 0 && videoTracks[0].readyState === 'live';
      
      if (!hasRemoteAudio || !hasRemoteVideo) {
        TimelineTelemetry.log('SyncGate', 'Tracks missing or not live', { audio: hasRemoteAudio, video: hasRemoteVideo });
        console.warn(`[Sync Gate] Blocked CONNECTED transition. Audio: ${hasRemoteAudio}, Video: ${hasRemoteVideo}. Re-checking...`);
        if (mediaCheckTimeoutRef.current) clearTimeout(mediaCheckTimeoutRef.current);
        mediaCheckTimeoutRef.current = setTimeout(checkAndSetConnected, 100);
        return;
      }

      // Strict Media Gate: Check byte flow
      try {
        const getStatsPromise = webrtcManager.getStats();
        if (!getStatsPromise) return;
        const stats = await getStatsPromise;

        let audioBytes = 0;
        let videoBytes = 0;

        stats.forEach((report: any) => {
          if (report.type === 'inbound-rtp') {
            if (report.mediaType === 'audio' || report.kind === 'audio') {
               audioBytes = report.bytesReceived || 0;
            }
            if (report.mediaType === 'video' || report.kind === 'video') {
               videoBytes = report.bytesReceived || 0;
            }
          }
        });

        if (audioBytes > 0 && videoBytes > 0) {
          TimelineTelemetry.log('SyncGate', 'Media bytes confirmed flowing', { audioBytes, videoBytes });
          console.log(`[Sync Gate] Media flowing. Audio bytes: ${audioBytes}, Video bytes: ${videoBytes}`);
          if (mediaCheckTimeoutRef.current) clearTimeout(mediaCheckTimeoutRef.current);
          LifecycleManager.getInstance().onConnected();
          
          // Bidirectional Agreement: Ask backend to verify the other party also has media
          if (sessionIdRef.current && sessionTokenRef.current && matchIdRef.current) {
            realtimeManager.markMediaConnected(sessionIdRef.current, sessionTokenRef.current, matchIdRef.current).catch(err => {
              console.error('[Sync Gate] Failed to mark media connected:', err);
            });
          }
        } else {
          TimelineTelemetry.log('SyncGate', 'Media bytes 0 - waiting for packets', { audioBytes, videoBytes });
          console.warn(`[Sync Gate] ICE connected but media bytes not flowing. Re-checking...`);
          if (mediaCheckTimeoutRef.current) clearTimeout(mediaCheckTimeoutRef.current);
          mediaCheckTimeoutRef.current = setTimeout(checkAndSetConnected, 100);
        }
      } catch (err) {
        console.error('[Sync Gate] Failed to retrieve stats:', err);
      }
    };

    webrtcManager.setCallbacks({
      onRemoteStream: (stream: MediaStream) => {
        if (partnerReconnectTimerRef.current) {
          clearTimeout(partnerReconnectTimerRef.current);
          partnerReconnectTimerRef.current = null;
        }
        setRemoteStream(stream);
        checkAndSetConnected();
      },
      onConnectionStateChange: (state: RTCPeerConnectionState) => {
        const statusMap: Record<RTCPeerConnectionState, ConnectionStatus> = {
          new: 'connecting',
          connecting: 'connecting',
          connected: 'connected',
          disconnected: 'reconnecting',
          failed: 'failed',
          closed: 'disconnected',
        };
        updateChatState({ connectionStatus: statusMap[state] });

        if (state === 'connecting') {
          setSignalingState('ICE_CONNECTING');
        } else if (state === 'connected') {
          if (partnerReconnectTimerRef.current) {
            clearTimeout(partnerReconnectTimerRef.current);
            partnerReconnectTimerRef.current = null;
          }
          if (reconnectIntervalRef.current) {
            clearInterval(reconnectIntervalRef.current);
            reconnectIntervalRef.current = null;
          }
          updateChatState({ reconnectCountdown: null });
          checkAndSetConnected();
        } else if (state === 'disconnected' || state === 'failed') {
          console.log(`[WebRTC State Change] State: ${state}. Starting reconnect countdown...`);
          startReconnectCountdown();
          if (state === 'failed') {
            showToast('error', 'Connection failed. Retrying connection...');
            if (sessionIdRef.current && partnerSessionIdRef.current) {
              void handleIceRestart();
            }
          }
        }
      },
      onIceConnectionStateChange: (state: RTCIceConnectionState) => {
        console.log(`[WebRTC] ICE Connection State changed to: ${state}`);
        if (state === 'disconnected' || state === 'failed') {
          console.log(`[WebRTC] ICE failure detected: ${state}.`);
          startReconnectCountdown();
          if (state === 'failed') {
            showToast('error', 'ICE Connection failed. Retrying connection...');
            if (sessionIdRef.current && partnerSessionIdRef.current) {
              void handleIceRestart();
            }
          }
        }
      },
      onIceCandidate: (candidate: RTCIceCandidateInit) => {
        const fromSessionId = sessionIdRef.current;
        if (partnerSessionIdRef.current && fromSessionId) {
          realtimeManager.sendIceCandidate(fromSessionId, candidate);
        }
      },
    });
  }, [showToast, updateChatState, handleIceRestart]);

  const handleMatched = useCallback(
    async (data: {
      matchId: string;
      partnerSessionId: string;
      isInitiator: boolean;
      iceServers: { urls: string | string[] }[];
      matchReasonMetadata?: any;
      partnerProfile?: any;
    }) => {
      if (!isMountedRef.current) return;
      if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
      
      const currentState = LifecycleManager.getInstance().getState();
      
      // If user cancelled right as match arrived, drop it
      if (currentState === 'ENDED' || currentState === 'HOME') {
        console.log('[Signaling] Match arrived after user cancelled. Dropping silently.');
        realtimeManager.leaveMatchChannel();
        return;
      }

      if (
        currentState === 'MATCH_FOUND' ||
        currentState === 'NEGOTIATING' ||
        currentState === 'CONNECTED'
      ) {
        console.log('[Signaling] Already in post-match pipeline. Ignoring duplicate matched event.');
        return;
      }

      if (webrtcManager.getConnectionState() === 'connected') {
        console.log('[Signaling] Already connected. Ignoring duplicate matched event.');
        return;
      }

      partnerSessionIdRef.current = data.partnerSessionId;
      isInitiatorRef.current = data.isInitiator;
      LifecycleManager.getInstance().onMatchFound({ matchId: data.matchId, partnerSessionId: data.partnerSessionId, isInitiator: data.isInitiator });
      startWebRTCTimeout(); // V4.1 Requirement 14

      let existingMessages: any[] = [];
      try {
        const msgs = await apiService.getChatMessages(data.matchId, sessionId || '', sessionToken || '');
        existingMessages = msgs.map((m: any) => ({
          id: m.id,
          senderSessionId: m.sender_session,
          message: m.message,
          createdAt: new Date(m.created_at).getTime(),
        }));
      } catch (err) {
        console.warn('Failed to restore chat messages:', err);
      }

      // Construct matched details system message
      
      const matchedBy = data.matchReasonMetadata?.matchedBy || [];
      const matchReason = data.matchReasonMetadata?.reason || 'random';

      // Stars rating based on compatibility
      let ratingBadge = '⭐⭐⭐ Random Match';
      if (matchedBy.length >= 2 && matchedBy[0] !== '🎲 Random Match') {
        ratingBadge = '⭐⭐⭐⭐⭐ Excellent Match';
      } else if (matchedBy.length === 1 && matchedBy[0] !== '🎲 Random Match') {
        ratingBadge = '⭐⭐⭐⭐ Good Match';
      }

      let matchTextLines: string[] = [];
      
      if (matchReason === 'strict_filters') {
        matchTextLines.push(`🔒 Exact Match • ${ratingBadge}`);
        matchTextLines.push(`You were matched because your selected filters matched perfectly.\nEnjoy your conversation.`);
      } else if (matchReason === 'prefer_filters' || (matchedBy.length > 0 && matchedBy[0] !== '🎲 Random Match')) {
        matchTextLines.push(`✨ Great Match • ${ratingBadge}`);
        
        // List the matches
        const details = data.matchReasonMetadata?.matchedByDetails;
        let finalNarrative = '';

        const myUni = safeLocalStorage.getItem('kaboom_university');
        const pUni = data.partnerProfile?.match_attributes?.university?.[0] || data.partnerProfile?.university;
        const matchedUni = details?.university || (myUni && pUni && myUni.toLowerCase() === pUni.toLowerCase() ? myUni : null);

        const myCity = safeLocalStorage.getItem('kaboom_city');
        const pCity = data.partnerProfile?.match_attributes?.city?.[0] || data.partnerProfile?.city;
        const matchedCity = details?.city || (myCity && pCity && myCity.toLowerCase() === pCity.toLowerCase() ? myCity : null);

        const myLanguages = safeLocalStorage.getJSON<string[]>('kaboom_languages', []);
        const pLanguages = data.partnerProfile?.match_attributes?.languages || data.partnerProfile?.languages || [];
        const sharedLanguages = myLanguages.filter(x => pLanguages.some((y: string) => y.toLowerCase() === x.toLowerCase()));
        const matchedLangsList = details?.languages || sharedLanguages;

        const myInterests = safeLocalStorage.getJSON<string[]>('kaboom_interest_tags', []);
        const pInterests = data.partnerProfile?.match_attributes?.interests || data.partnerProfile?.interest_tags || [];
        const sharedInterests = myInterests.filter(x => pInterests.some((y: string) => y.toLowerCase() === x.toLowerCase()));
        const matchedInterestsList = details?.interests || sharedInterests;

        const hasUni = !!matchedUni;
        const hasCity = !!matchedCity;
        const hasLang = matchedLangsList && matchedLangsList.length > 0;
        const hasInterest = matchedInterestsList && matchedInterestsList.length > 0;

        if (hasUni && hasLang) {
          finalNarrative = `Both of you are from ${matchedUni} and speak ${matchedLangsList[0]}.`;
        } else if (hasUni && hasInterest) {
          finalNarrative = `${matchedInterestsList[0]} students from ${matchedUni} just matched.`;
        } else if (hasCity && hasInterest) {
          finalNarrative = `You matched because you both are from ${matchedCity} and enjoy ${matchedInterestsList[0]}.`;
        } else if (hasUni) {
          finalNarrative = `You both study at ${matchedUni}.\nLooks like you're from the same campus.`;
        } else if (hasCity) {
          finalNarrative = `You're both from ${matchedCity}.\nSomeone nearby just matched with you.`;
        } else if (hasLang) {
          finalNarrative = `Both of you speak ${matchedLangsList[0]}.\nYou can start chatting in ${matchedLangsList[0]}.`;
        } else if (hasInterest) {
          finalNarrative = `Looks like you both enjoy ${matchedInterestsList[0]}.\nShared hobbies make conversations easier.`;
        } else {
          const matchedState = details?.state || (safeLocalStorage.getItem('kaboom_state') === data.partnerProfile?.state ? data.partnerProfile?.state : null);
          const matchedCountry = details?.country || (safeLocalStorage.getItem('kaboom_country') === data.partnerProfile?.country ? data.partnerProfile?.country : null);
          if (matchedState) {
            finalNarrative = `Both of you are from the state of ${matchedState}.`;
          } else if (matchedCountry) {
            finalNarrative = `Both of you are from the same country: ${matchedCountry}.`;
          } else {
            finalNarrative = `You share several preferences.\nSome filters were relaxed to help you meet faster.\nEnjoy!`;
          }
        }

        matchTextLines.push(finalNarrative);
      } else {
        matchTextLines.push(`🎲 Random Match • ${ratingBadge}`);
        matchTextLines.push(`No common filters were found.\nMeet someone completely new today!\nSometimes the best conversations are unexpected.`);
      }

      const matchText = matchTextLines.join('\n');

      const systemMsg = {
        id: `system_${Date.now()}`,
        senderSessionId: 'system',
        message: matchText,
        createdAt: Date.now() - 1000,
        type: 'system_match'
      };
      existingMessages.unshift(systemMsg);

      matchIdRef.current = data.matchId;
      partnerSessionIdRef.current = data.partnerSessionId;

      LifecycleManager.getInstance().onMatchFound({ matchId: data.matchId, partnerSessionId: data.partnerSessionId, isInitiator: data.isInitiator }); // V19 Fix: Unblocks FSM Gate

      updateChatState({
        connectionStatus: 'connecting',
        partnerSessionId: data.partnerSessionId,
        matchId: data.matchId,

        matchStartTime: Date.now(),
        liked: false,
        partnerLiked: false,
        mutualLike: false,
        messages: existingMessages,
        unreadCount: 0,
        partnerTyping: false,
        partnerProfile: data.partnerProfile || null,
        matchReasonMetadata: data.matchReasonMetadata || null,
      });
    },
    [updateChatState, startWebRTCTimeout]
  );

  const handleStartNegotiation = useCallback(
    async (data: {
      matchId: string;
      partnerSessionId: string;
      isInitiator: boolean;
      iceServers: { urls: string | string[] }[];
      matchReasonMetadata?: any;
      partnerProfile?: any;
    }) => {
      if (skipInProgressRef.current) return;
      if (
        LifecycleManager.getInstance().getState() === 'NEGOTIATING' ||
        LifecycleManager.getInstance().getState() === 'CONNECTED'
      ) {
        console.log('[Signaling] Already negotiating/connected. Ignoring duplicate startNegotiation event.');
        return;
      }

      if (webrtcManager.getConnectionState() === 'connected') {
        console.log('[Signaling] Already connected. Ignoring duplicate startNegotiation event.');
        return;
      }

      partnerSessionIdRef.current = data.partnerSessionId;
      matchIdRef.current = data.matchId;
      isInitiatorRef.current = data.isInitiator;

      clearSignalingRetryTimers();
      webrtcManager.setIceServers(data.iceServers);
      webrtcManager.createPeerConnection();
      setSignalingState('READY');
      startWebRTCTimeout(); // V4.1 Requirement 14

      updateChatState({
        connectionStatus: 'connecting',
        partnerSessionId: data.partnerSessionId,
        matchId: data.matchId,

        partnerProfile: data.partnerProfile || null,
        matchReasonMetadata: data.matchReasonMetadata || null,
      });

      if (data.isInitiator) {
        try {
          setSignalingState('NEGOTIATING');
          const offer = await webrtcManager.createOffer();
          if (sessionIdRef.current) {
            realtimeManager.sendOffer(sessionIdRef.current, offer);

            let retryCount = 0;
            if (offerRetryTimerRef.current) clearInterval(offerRetryTimerRef.current);
            offerRetryTimerRef.current = setInterval(() => {
              retryCount++;
              if (retryCount > 1) {
                console.warn('[Signaling] Offer ACK strictly timed out. Restarting negotiation via requeue.');
                if (offerRetryTimerRef.current) clearInterval(offerRetryTimerRef.current);
                offerRetryTimerRef.current = null;
                void triggerAutoRejoinRef.current?.();
                return;
              }
              console.log('[Signaling] Offer ACK not received, retrying offer once...');
              if (sessionIdRef.current) {
                realtimeManager.sendOffer(sessionIdRef.current, offer);
              }
            }, 5000);
          }
        } catch (error) {
          showToast('error', 'Failed to create connection offer');
          console.error(error);
        }
      }
    },
    [showToast, updateChatState, clearSignalingRetryTimers, startWebRTCTimeout]
  );

  const triggerAutoRejoin = useCallback(async () => {
    if (!sessionIdRef.current || !sessionTokenRef.current || !callbacksRef.current) return;
    if (skipInProgressRef.current) return;

    if (!navigator.onLine) {
      setSignalingState('IDLE');
      showToast('error', 'You are offline. Please check your internet connection.');
      return;
    }

    skipInProgressRef.current = true;
    console.log('[Queue] Auto-rejoining queue...');
    setSignalingState('REQUEUEING');

    // Reset local/remote signaling states before re-entering queue
    clearAllTimers();
    realtimeManager.leaveMatchChannel();
    setRemoteStream(null);
    webrtcManager.resetConnection();
    lastProcessedOfferSdpRef.current = null;
    lastProcessedAnswerSdpRef.current = null;

    updateChatState({
      partnerSessionId: null,
      matchId: null,
      matchStartTime: null,
      liked: false,
      partnerLiked: false,
      mutualLike: false,
      messages: [],
      unreadCount: 0,
      partnerTyping: false,
      reconnectCountdown: null,
    });

    try {
      await realtimeManager.joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      if (!isMountedRef.current) return;
      if (LifecycleManager.getInstance().getState() === ('QUEUEING')) {
        setSignalingState('SEARCHING');
      }
      console.log('[Lifecycle] Queue Joined');
    } catch (error) {
      console.error('[Queue] Auto-rejoin failed:', error);
      // Retry in 3 seconds if failed
      if (rejoinRetryTimeoutRef.current) clearTimeout(rejoinRetryTimeoutRef.current);
      rejoinRetryTimeoutRef.current = setTimeout(() => {
        skipInProgressRef.current = false;
        void triggerAutoRejoin();
      }, 3000);
    } finally {
      skipInProgressRef.current = false;
    }
  }, [clearSignalingRetryTimers, updateChatState]);

  triggerAutoRejoinRef.current = triggerAutoRejoin;

  function buildCallbacks() {
    return {
      onWaiting: (data: { queuePosition: number; message: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        setSignalingState('SEARCHING');
        updateChatState({
          queuePosition: data.queuePosition,
          connectionStatus: 'connecting',
        });
      },
      onReaction: (data: { emoji: string; matchId: string; senderSessionId: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data.matchId !== matchIdRef.current) return; // Phase 5 Strict Isolation
        const fromLocal = data.senderSessionId === sessionIdRef.current;
        onReactionRef.current?.(data.emoji, fromLocal);
      },
      onMatched: (data: any) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data?.eventId && processedEventsRef.current.has(data.eventId)) {
          console.log('[Signaling] Duplicate matched event ignored. eventId:', data.eventId);
          return;
        }
        if (data?.eventId) processedEventsRef.current.add(data.eventId);

        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Ignoring duplicate matched event.');
          return;
        }
        handleMatchedRef.current?.(data);
      },
      onStartNegotiation: (data: any) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data?.eventId && processedEventsRef.current.has(data.eventId)) {
          console.log('[Signaling] Duplicate startNegotiation event ignored. eventId:', data.eventId);
          return;
        }
        if (data?.eventId) processedEventsRef.current.add(data.eventId);

        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Ignoring duplicate startNegotiation event.');
          return;
        }
        handleStartNegotiationRef.current?.(data);
      },
      onSessionConnected: (data: { matchId: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data.matchId !== matchIdRef.current) return;
        console.log(`[Websocket Event] session_connected for match ${data.matchId}`);
        setSignalingState('CONNECTED');
      },
      onPartnerLeft: (data?: { reason: string; eventId?: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        console.log(`[Websocket Event] partnerLeft received (reason: ${data?.reason || 'unknown'})`);
        if (data?.eventId && processedEventsRef.current.has(data.eventId)) {
          console.log('[Signaling] Duplicate partner_left event ignored. eventId:', data.eventId);
          return;
        }
        if (data?.eventId) processedEventsRef.current.add(data.eventId);

        if (data?.reason === 'disconnect') {
          console.log('[Grace Period] Partner disconnected accidentally. Starting 10s grace period...');
          updateChatState({ partnerSkipPending: false });
          startReconnectCountdownRef.current?.();
          return;
        }

        executePartnerLeftTeardownRef.current?.();
      },
      onSearching: (data: { message: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        setSignalingState('SEARCHING');
        updateChatState({ connectionStatus: 'connecting' });
        showToast('info', data.message);
      },
      onError: (data: { message: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        showToast('error', data.message);

        if (data.message.includes('lost') || data.message.includes('Reconnecting')) {
          const status = LifecycleManager.getInstance().getState();
          if (status !== 'CONNECTED' && status !== 'ENDED' && status !== ('IDLE' as any)) {
            console.log('[Websocket Reconnect] Connection lost. Attempting automatic reconnection...');
            if (connectRetryTimeoutRef.current) clearTimeout(connectRetryTimeoutRef.current);
            connectRetryTimeoutRef.current = setTimeout(() => {
              void startChatRef.current?.();
            }, 3000);
          } else {
            console.log('[Websocket Reconnect] Connection lost but status is stable or closed. Skipping auto-reconnect retry.');
          }
        }
      },
      onPartnerLiked: () => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        // Silently record that the partner liked — do NOT reveal this to the user.
        // The like must remain hidden until MUTUAL_LIKE is emitted by the backend.
        updateChatState({ partnerLiked: true });
      },
      onMutualLike: () => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        setChatState((prev) => {
          const newMessages = prev.messages ? [...prev.messages] : [];
          const hasMutualMsg = newMessages.some((m) => m.id.startsWith('system-mutual-like'));
          if (!hasMutualMsg) {
            newMessages.push({
              id: 'system-mutual-like-' + Math.random().toString(),
              senderSessionId: 'system',
              message: '❤️ You both liked each other\nLooks like there\'s mutual interest.',
              createdAt: Date.now(),
            });
          }
          return {
            ...prev,
            mutualLike: true,
            messages: newMessages,
          };
        });
      },
      onPartnerSkipPending: () => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        updateChatState({ partnerSkipPending: true });
      },
      onPartnerSkipCancelled: () => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        updateChatState({ partnerSkipPending: false });
      },
      onPartnerReconnect: () => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        console.log('[Signaling] Partner reconnected. Triggering ICE restart...');
        if (isInitiatorRef.current) {
          void handleIceRestart();
        }
      },
      onNewMessage: (data: { matchId: string; senderSessionId: string; message: string; createdAt: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        setChatState((prev) => {
          const newMessages = prev.messages ? [...prev.messages] : [];
          newMessages.push({
            id: Math.random().toString(),
            senderSessionId: data.senderSessionId,
            message: data.message,
            createdAt: new Date(data.createdAt).getTime(),
          });
          const unread = prev.isChatOpen ? 0 : (prev.unreadCount || 0) + 1;
          return {
            ...prev,
            messages: newMessages,
            unreadCount: unread,
          };
        });
      },
      onPartnerTyping: (data: { typing: boolean }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        updateChatState({ partnerTyping: data.typing });
      },
      onMessageSeen: (data: { matchId: string; senderId: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data.senderId === sessionIdRef.current) {
          setChatState((prev) => {
            const updated = prev.messages
              ? prev.messages.map((m) =>
                  m.senderSessionId === sessionIdRef.current ? { ...m, status: 'seen' as const } : m
                )
              : [];
            return { ...prev, messages: updated };
          });
        }
      },
      onOffer: async (data: { fromSessionId: string; offer: RTCSessionDescriptionInit; matchId: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data.matchId && matchIdRef.current && data.matchId !== matchIdRef.current) {
          console.warn(`[Signaling] Stale onOffer rejected. Expected ${matchIdRef.current}, got ${data.matchId}`);
          return;
        }

        // Phase 3 fix: Always send ACK first so the remote peer stops retrying the offer,
        // even if we are already connected!
        if (sessionIdRef.current) {
          realtimeManager.sendOfferAck(sessionIdRef.current);
        }

        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Sent offer ACK and ignored duplicate offer.');
          return;
        }

        const state = LifecycleManager.getInstance().getState();
        const isCollision = state === 'NEGOTIATING' || state === ('READY' as any);
        const isPolite = !isInitiatorRef.current;

        if (isCollision) {
          if (!isPolite) {
            console.log('[Signaling] Offer collision. Impolite peer ignores remote offer.');
            return;
          }
          console.log('[Signaling] Offer collision. Polite peer accepts remote offer.');
          if (lastProcessedOfferSdpRef.current) {
            console.log('[Signaling] Split-brain deduplication: ignoring duplicate offer from same session.');
            return;
          }
        }

        if (state === 'CONNECTED') {
          console.log('[Signaling] Already stable. Ignoring duplicate offer.');
          return;
        }

        // Phase 3: Deduplicate identical SDPs to prevent setRemoteDescription issues
        if (lastProcessedOfferSdpRef.current === data.offer.sdp) {
          console.log('[Signaling] Already processed this offer SDP. Skipping handleOffer.');
          return;
        }
        lastProcessedOfferSdpRef.current = data.offer.sdp || null;

        try {
          setSignalingState('NEGOTIATING');
          const answer = await webrtcManager.handleOffer(data.offer);

          if (sessionIdRef.current) {
            realtimeManager.sendAnswer(sessionIdRef.current, answer);

            let retryCount = 0;
            if (answerRetryTimerRef.current) clearInterval(answerRetryTimerRef.current);
            answerRetryTimerRef.current = setInterval(() => {
              retryCount++;
              if (retryCount > 1) {
                console.warn('[Signaling] Answer ACK strictly timed out. Restarting negotiation via requeue.');
                if (answerRetryTimerRef.current) clearInterval(answerRetryTimerRef.current);
                answerRetryTimerRef.current = null;
                void triggerAutoRejoinRef.current?.();
                return;
              }
              console.log('[Signaling] Answer ACK not received, retrying answer once...');
              if (sessionIdRef.current) {
                realtimeManager.sendAnswer(sessionIdRef.current, answer);
              }
            }, 5000);
          }
        } catch (error) {
          showToast('error', 'Failed to handle connection offer');
          console.error(error);
        }
      },
      onOfferAck: (data: { fromSessionId: string; matchId: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data.matchId && matchIdRef.current && data.matchId !== matchIdRef.current) return;
        
        console.log('[Signaling] Offer ACK received, clearing retry timer.');
        if (offerRetryTimerRef.current) {
          clearInterval(offerRetryTimerRef.current);
          offerRetryTimerRef.current = null;
        }
      },
      onAnswer: async (data: { fromSessionId: string; answer: RTCSessionDescriptionInit; matchId: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data.matchId && matchIdRef.current && data.matchId !== matchIdRef.current) {
          console.warn(`[Signaling] Stale onAnswer rejected. Expected ${matchIdRef.current}, got ${data.matchId}`);
          return;
        }

        // Phase 3 fix: Always send ACK first so the remote peer stops retrying the answer,
        // even if we are already connected!
        if (sessionIdRef.current) {
          realtimeManager.sendAnswerAck(sessionIdRef.current);
        }

        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Sent answer ACK and ignored duplicate answer.');
          return;
        }

        const state = LifecycleManager.getInstance().getState();
        if (state === 'CONNECTED') {
          console.log('[Signaling] Already stable. Ignoring duplicate answer.');
          return;
        }

        // Phase 3: Deduplicate identical SDPs to prevent setRemoteDescription issues
        if (lastProcessedAnswerSdpRef.current === data.answer.sdp) {
          console.log('[Signaling] Already processed this answer SDP. Skipping handleAnswer.');
          return;
        }
        lastProcessedAnswerSdpRef.current = data.answer.sdp || null;

        try {
          await webrtcManager.handleAnswer(data.answer);
        } catch (error) {
          showToast('error', 'Failed to handle connection answer');
          console.error(error);
        }
      },
      onAnswerAck: (data: { fromSessionId: string; matchId: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data.matchId && matchIdRef.current && data.matchId !== matchIdRef.current) return;

        console.log('[Signaling] Answer ACK received, clearing retry timer.');
        if (answerRetryTimerRef.current) {
          clearInterval(answerRetryTimerRef.current);
          answerRetryTimerRef.current = null;
        }
      },
      onIceCandidate: async (data: { candidate: RTCIceCandidateInit; matchId: string }) => {
        if (skipInProgressRef.current && LifecycleManager.getInstance().getState() !== ('QUEUEING')) return;
        if (data.matchId && matchIdRef.current && data.matchId !== matchIdRef.current) return;
        
        await webrtcManager.addIceCandidate(data.candidate);
      },
      onReconnect: async () => {
        if (!sessionIdRef.current || !sessionTokenRef.current) return;
        try {
          const status = await apiService.getMatchStatus(sessionIdRef.current, sessionTokenRef.current);
          if (status.status === 'matched') {
            console.log('[Realtime] Socket reconnected and backend reports MATCHED. Restoring state...');
            handleMatched(status);
          } else if (status.status === 'waiting') {
            if (LifecycleManager.getInstance().getState() !== ('QUEUEING') && !skipInProgressRef.current) {
              setSignalingState('SEARCHING');
            }
          }
        } catch (error) {
          console.error('[Realtime] Failed to sync status on reconnect:', error);
        }
      },
    };
  }

  const startChat = useCallback(async () => {
    if (!sessionId || !sessionToken) {
      showToast('error', 'Session not initialized');
      return;
    }

    try {
      setSignalingState('REQUESTING_MEDIA');

      const stream = await webrtcManager.getLocalMedia();
      setLocalStream(stream);
      setSignalingState('MEDIA_READY');
      await setupWebRTC();

      const callbacks = buildCallbacks();
      callbacksRef.current = callbacks;
      setSignalingState('CONNECTING_REALTIME');
      
      try {
        await realtimeManager.connectRealtime(sessionId, sessionToken, callbacks);
      } catch (wsError: any) {
        console.warn('[Realtime] WebSocket connection failed after 3 attempts. Falling back to standard polling for match status.');
        // Standard polling fallback for matchmaking
        setSignalingState('SEARCHING');
        const pollInterval = setInterval(async () => {
          try {
             if (LifecycleManager.getInstance().getState() === 'ENDED' || LifecycleManager.getInstance().getState() === 'HOME') {
               clearInterval(pollInterval);
               return;
             }
             const statusRes = await apiService.getMatchStatus(sessionId, sessionToken);
             if (statusRes && statusRes.status === 'matched') {
               clearInterval(pollInterval);
               console.log('[Lifecycle] Resuming active match via polling fallback');
               await handleMatchedRef.current?.(statusRes);
               await handleStartNegotiationRef.current?.(statusRes);
             } else if (statusRes && statusRes.status === 'searching') {
               // still searching
             } else if (!statusRes || statusRes.status === 'waiting') {
               // attempt to join queue via REST
               // We would need a REST endpoint to join queue if WebSocket is entirely dead.
               // Currently `apiService` does not have a joinQueue endpoint, so polling will just check status.
             }
          } catch (e) {
             console.error('[Polling] Failed to poll match status:', e);
          }
        }, 3000);
        return; // Early return since we can't join Realtime queue
      }

      // --- Wave 3 Refresh Logic ---
      const statusRes = await apiService.getMatchStatus(sessionId, sessionToken);
      if (statusRes && statusRes.status === 'matched') {
         console.log('[Lifecycle] Resuming active match instead of joining queue');
         
         // In order to let ChatPage know the profile, we pass it down. 
         // Since handleMatched is responsible for formatting the matched reason/profile message,
         // we should call handleMatched to populate UI correctly. 
         await handleMatchedRef.current?.(statusRes);
         
         // We also must start WebRTC negotiation. 
         await handleStartNegotiationRef.current?.(statusRes);
         
         // If we are NOT the initiator, we ask the initiator to send an offer
         if (!statusRes.isInitiator) {
            realtimeManager.sendReconnectPing();
         }
         return;
      }
      // ----------------------------

      await realtimeManager.joinQueue(sessionId, sessionToken, callbacks);
      if (LifecycleManager.getInstance().getState() === ('QUEUEING')) {
        setSignalingState('SEARCHING');
        console.log('[Lifecycle] Queue Joined');
      } else if (LifecycleManager.getInstance().getState() === 'ENDED' || LifecycleManager.getInstance().getState() === ('HOME')) {
        // KS-C8 Fix: Compensatory leaveQueue
        // If the user clicked "Cancel" (stopChat) while the joinQueue request was in-flight,
        // the signalingState was set to 'ENDED' synchronously. We must undo the join.
        console.warn('[Lifecycle] Aborted during joinQueue. Cleaning up ghost queue entry.');
        realtimeManager.leaveQueue(sessionId, sessionToken).catch(() => {});
        realtimeManager.disconnectRealtime();
      }
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Camera and microphone permissions are required'
          : error instanceof Error
            ? error.message
            : 'Failed to start chat. Please check your camera and microphone.';
      showToast('error', message);
      setSignalingState('IDLE');
      updateChatState({ connectionStatus: 'disconnected' });
    }
  }, [sessionId, sessionToken, showToast, setupWebRTC, handleMatched, handleStartNegotiation, updateChatState]);

  const stopChat = useCallback(async () => {
    clearAllTimers();
    const currentMatchId = matchIdRef.current;
    setSignalingState('ENDED');
    if (sessionIdRef.current && sessionTokenRef.current) {
      await realtimeManager.notifyDisconnect(sessionIdRef.current, sessionTokenRef.current, 'leave', currentMatchId ?? undefined);
      await realtimeManager.leaveQueue(sessionIdRef.current, sessionTokenRef.current, currentMatchId ?? undefined).catch(() => {});
    }
    console.log('[Lifecycle] Queue Left');
    realtimeManager.disconnectRealtime();
    webrtcManager.cleanup();
    setLocalStream(null);
    setRemoteStream(null);
    lastProcessedOfferSdpRef.current = null;
    lastProcessedAnswerSdpRef.current = null;
    setChatState(initialChatState);
    partnerSessionIdRef.current = null;
    matchIdRef.current = null;
  }, [clearAllTimers]);

  const handleNext = useCallback(async (reason: string = 'next') => {
    if (!sessionIdRef.current || !sessionTokenRef.current || !callbacksRef.current) return;
    if (skipInProgressRef.current) return;

    // Disallow skip if we are already searching
    if (LifecycleManager.getInstance().getState() === ('QUEUEING')) {
      console.log('[Queue] Cannot skip while actively searching.');
      return;
    }

    skipInProgressRef.current = true;
    const currentMatchId = matchIdRef.current;
    console.log(`[Queue] handleNext: switching to next partner... (Current Match: ${currentMatchId}, reason: ${reason})`);
    setSignalingState('REQUEUEING');

    clearAllTimers();
    realtimeManager.leaveMatchChannel();
    webrtcManager.resetConnection();
    lastProcessedOfferSdpRef.current = null;
    lastProcessedAnswerSdpRef.current = null;
    partnerSessionIdRef.current = null;
    matchIdRef.current = null;
    updateChatState({
      partnerSessionId: null,
      matchId: null,
      matchStartTime: null,
      liked: false,
      partnerLiked: false,
      mutualLike: false,
      messages: [],
      unreadCount: 0,
      partnerTyping: false,
    });

    try {
      await realtimeManager.nextPartner(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current, currentMatchId ?? undefined, reason);
      if (!isMountedRef.current) return;
      
      if (LifecycleManager.getInstance().getState() === ('QUEUEING')) {
        setSignalingState('SEARCHING');
      } else {
        // KS-C9 Fix: Compensatory leaveQueue
        // If stopChat was called during nextPartner, we must undo the queue insertion.
        console.warn('[Lifecycle] Aborted during nextPartner. Cleaning up ghost queue entry.');
        realtimeManager.leaveQueue(sessionIdRef.current, sessionTokenRef.current).catch(() => {});
      }
      
      // Only release lock after successful requeue
      skipInProgressRef.current = false;
    } catch (error: any) {
      if (error.status === 409) {
        console.warn('[Queue] 409 Conflict ignored during nextPartner (matched concurrently).');
        skipInProgressRef.current = false;
        return;
      }
      console.error('Error switching to next partner:', error);
      showToast('error', 'Failed to find a new partner. Retrying...');
      if (sessionIdRef.current && sessionTokenRef.current) {
        realtimeManager.notifyDisconnect(sessionIdRef.current, sessionTokenRef.current, 'leave', currentMatchId ?? undefined).catch(() => {});
      }
      // Keep lock engaged while auto-rejoining to prevent overlap
      void triggerAutoRejoin().finally(() => {
        skipInProgressRef.current = false;
      });
    }
  }, [updateChatState, clearSignalingRetryTimers, showToast, triggerAutoRejoin]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const toggleMute = useCallback(() => {
    setChatState((prev) => {
      const newMuted = !prev.isMuted;
      webrtcManager.toggleMute(newMuted);
      return { ...prev, isMuted: newMuted };
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setChatState((prev) => {
      const cameraOn = prev.isCameraOff;
      webrtcManager.toggleCamera(cameraOn);
      return { ...prev, isCameraOff: !prev.isCameraOff };
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setChatState((prev) => {
      const nextFullscreen = !prev.isFullscreen;
      try {
        if (nextFullscreen) {
          if (document.documentElement.requestFullscreen) {
            void document.documentElement.requestFullscreen();
          } else if ((document.documentElement as any).webkitRequestFullscreen) {
            void (document.documentElement as any).webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            void document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            void (document as any).webkitExitFullscreen();
          }
        }
      } catch (err) {
        console.warn('Fullscreen toggle failed:', err);
      }
      return { ...prev, isFullscreen: nextFullscreen };
    });
  }, []);

  // Periodically query WebRTC stats for RTT and connection quality badge (V5.1 Requirement 12 & 16)
  useEffect(() => {
    if (chatState.status !== 'CONNECTED') {
      updateChatState({ connectionQuality: null });
      return;
    }

    const interval = setInterval(async () => {
      const getStatsPromise = webrtcManager.getStats();
      if (!getStatsPromise) return;

      try {
        const stats = await getStatsPromise;
        let rtt = 0;
        let packetsLost = 0;
        let currentFramesDecoded = 0;
        let hasVideoReport = false;

        stats.forEach((report: any) => {
          if (report.type === 'remote-inbound-rtp' && report.roundTripTime) {
            rtt = report.roundTripTime * 1000;
          }
          if (report.type === 'inbound-rtp') {
            if (report.packetsLost !== undefined) {
              packetsLost = report.packetsLost;
            }
            if (report.mediaType === 'video' && report.framesDecoded !== undefined) {
              currentFramesDecoded = report.framesDecoded;
              hasVideoReport = true;
            }
          }
        });

        let quality: 'excellent' | 'good' | 'poor' = 'excellent';
        if (rtt > 250 || packetsLost > 20) {
          quality = 'poor';
        } else if (rtt > 100 || packetsLost > 5) {
          quality = 'good';
        }

        updateChatState({ connectionQuality: quality });

        // Stall detection logic
        if (hasVideoReport) {
          const track = webrtcManager.getRemoteStream()?.getVideoTracks()?.[0];
          if (track && track.readyState === 'live' && !track.muted) {
            if (currentFramesDecoded === lastFramesDecodedRef.current) {
              stalledCountRef.current += 1;
              console.warn(`[WebRTC Stall Detection] Remote video track active but framesDecoded flat for ${stalledCountRef.current * 4}s`);
              
              if (stalledCountRef.current >= 3) { // 12 seconds of consecutive flat frames
                console.log('[WebRTC Recovery] Stream stalled. Initiating ICE restart...');
                stalledCountRef.current = 0;
                void handleIceRestart();
              }
            } else {
              stalledCountRef.current = 0;
            }
            lastFramesDecodedRef.current = currentFramesDecoded;
          }
        }
      } catch (err) {
        console.warn('[WebRTC Stats] Failed to query stats:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [chatState.status, updateChatState, handleIceRestart]);

  // Queue Polling Heartbeat: Runs ONLY when searching/waiting
  useEffect(() => {
    if (
      chatState.status !== ('SEARCHING' as any) ||
      isQueuePaused ||
      skipInProgressRef.current ||
      webrtcManager.getConnectionState() === 'connected' ||
      !sessionId ||
      !sessionToken ||
      !callbacksRef.current
    ) {
      return;
    }

    const interval = setInterval(async () => {
      if (skipInProgressRef.current || webrtcManager.getConnectionState() === 'connected') return;
      try {
        await realtimeManager.joinQueue(sessionId, sessionToken, callbacksRef.current!);
      } catch (error) {
        console.error('Error polling matchmaking queue:', error);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [chatState.status, isQueuePaused, sessionId, sessionToken]);

  // V6.15: Periodic active-call heartbeat to update last_activity during conversation
  useEffect(() => {
    if (chatState.status !== 'CONNECTED' || !sessionId || !sessionToken) {
      if (activeHeartbeatIntervalRef.current) {
        clearInterval(activeHeartbeatIntervalRef.current);
        activeHeartbeatIntervalRef.current = null;
      }
      return;
    }

    const runHeartbeat = async () => {
      try {
        await apiService.submitHeartbeat(sessionId, sessionToken, LifecycleManager.getInstance().getState());
      } catch (err) {
        console.warn('[Heartbeat] Active heartbeat failed:', err);
      }
    };

    // Send immediate heartbeat on connect, then tick every 3 seconds
    void runHeartbeat();
    activeHeartbeatIntervalRef.current = setInterval(runHeartbeat, 3000);

    return () => {
      if (activeHeartbeatIntervalRef.current) {
        clearInterval(activeHeartbeatIntervalRef.current);
        activeHeartbeatIntervalRef.current = null;
      }
    };
  }, [chatState.status, sessionId, sessionToken]);

  // Mobile Lifecycle Event Listeners: visibilitychange, pagehide, freeze/resume, online/offline
  useEffect(() => {
    const API_BASE = environment.apiUrl;
    let visibilityDebounceTimer: any = null;

    const suspendLocalMedia = () => {
      console.log('[Lifecycle] Suspending local media to prevent background hardware crashes');
      const activeStream = webrtcManager.getLocalStream();
      if (activeStream) {
        activeStream.getTracks().forEach((track: MediaStreamTrack) => {
          track.enabled = false;
        });
      }
    };

    const performTeardown = () => {
      if (sessionIdRef.current && sessionTokenRef.current) {
        // SendBeacon ensures payload is sent even if page is closing/suspending instantly
        const url = `${API_BASE}/api/match/disconnect`;
        const payload = JSON.stringify({
          sessionId: sessionIdRef.current,
          sessionToken: sessionTokenRef.current,
          reason: 'disconnect',
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        } else {
          void realtimeManager.notifyDisconnect(sessionIdRef.current, sessionTokenRef.current, 'disconnect');
        }
      }
    };

    const handleUnloadOrHide = (e?: Event) => {
      const isClosing = e?.type === 'beforeunload';
      console.log(`[Lifecycle] Event: ${e?.type || 'manual'} | isClosing: ${isClosing}`);
      
      if (isClosing) {
        const isCallActive = [
          'QUEUEING', 'MATCH_FOUND', 'READY', 'NEGOTIATING', 'ICE_CONNECTING', 'CONNECTED'
        ].includes(LifecycleManager.getInstance().getState());

        if (isCallActive && e) {
          e.preventDefault();
          e.returnValue = true; // Required for Chrome/Safari to show prompt
        }

        suspendLocalMedia();
        performTeardown();
      }
    };

    const handleResumeOrFocus = async () => {
      console.log('[Lifecycle] App resumed or focused. Re-enabling camera tracks.');
      
      const isCallActive = [
        'REQUESTING_MEDIA', 'MEDIA_READY', 'CONNECTING_REALTIME', 
        'QUEUEING', 'PARTNER_LEFT', 'MATCH_FOUND', 'READY', 'NEGOTIATING', 'ICE_CONNECTING', 'CONNECTED'
      ].includes(LifecycleManager.getInstance().getState());

      if (isCallActive && !isQueuePausedRef.current) {
        const activeStream = webrtcManager.getLocalStream();
        if (activeStream) {
          activeStream.getTracks().forEach((track: MediaStreamTrack) => {
            track.enabled = true;
          });
        } else {
          // If stream was somehow lost, reacquire
          try {
            const stream = await webrtcManager.getLocalMedia();
            setLocalStream(stream);
            
            // Rebind tracks to peer connection if it exists
            const pc = (webrtcManager as any).peerConnection;
            if (pc && pc.connectionState !== 'closed') {
              const senders = pc.getSenders();
              stream.getTracks().forEach((track: MediaStreamTrack) => {
                const sender = senders.find((s: any) => s.track && s.track.kind === track.kind);
                if (sender) {
                  sender.replaceTrack(track).catch((e: any) => console.warn('[Lifecycle] replaceTrack failed:', e));
                }
              });
            }
          } catch (err) {
            console.error('[Lifecycle] Failed to reacquire media on focus:', err);
          }
        }

        // MT3 Fix: Immortal Ghost Session verification
        if (LifecycleManager.getInstance().getState() === 'CONNECTED' && sessionIdRef.current && sessionTokenRef.current) {
          try {
            const statusRes = await apiService.getMatchStatus(sessionIdRef.current, sessionTokenRef.current);
            if (statusRes.status !== 'matched') {
              console.log('[Lifecycle] Ghost session detected. Backend match is dead.');
              executePartnerLeftTeardownRef.current?.('Partner disconnected while app was backgrounded.');
            }
          } catch (e) {
            console.warn('[Lifecycle] Ghost check failed', e);
          }
        }
      }

      // Self-healing queue: If status is SEARCHING, send a heartbeat joinQueue immediately
      if (LifecycleManager.getInstance().getState() === ('QUEUEING') && !isQueuePausedRef.current && sessionIdRef.current && sessionTokenRef.current && callbacksRef.current) {
        console.log('[Lifecycle] Queue active — forcing immediate heartbeat registration');
        void realtimeManager.joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      }
    };

    const handleOnline = () => {
      console.log('[Lifecycle] Internet connection restored');
      if (LifecycleManager.getInstance().getState() === ('QUEUEING') && !isQueuePausedRef.current && sessionIdRef.current && sessionTokenRef.current && callbacksRef.current) {
        void realtimeManager.joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      }
    };

    // Keep track of internal state to prevent duplicate/looping triggers
    let isCurrentlyBackgrounded = false;

    const executeSuspend = () => {
      if (!isCurrentlyBackgrounded) {
        isCurrentlyBackgrounded = true;
        suspendLocalMedia();
      }
    };

    const executeResume = () => {
      if (visibilityDebounceTimer) {
        clearTimeout(visibilityDebounceTimer);
        visibilityDebounceTimer = null;
      }
      if (isCurrentlyBackgrounded) {
        isCurrentlyBackgrounded = false;
        void handleResumeOrFocus();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Debounce suspension to prevent flapping if OS rapidly toggles visibility
        if (visibilityDebounceTimer) clearTimeout(visibilityDebounceTimer);
        visibilityDebounceTimer = setTimeout(executeSuspend, 1000);
      } else {
        executeResume();
      }
    };

    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', handleUnloadOrHide);

    const handleResume = () => executeResume();
    const handleFocus = () => executeResume();
    document.addEventListener('resume', handleResume);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      isMountedRef.current = false;
      if (visibilityDebounceTimer) clearTimeout(visibilityDebounceTimer);
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      window.removeEventListener('pagehide', handleUnloadOrHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('freeze', handleUnloadOrHide);
      document.removeEventListener('resume', handleResume);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      
      performTeardown(); // KS-008: SPA unmount triggers disconnect
      clearAllTimers();
      webrtcManager.cleanup();
      realtimeManager.disconnectRealtime();
    };
  }, []);


  // Synchronize internal full-screen state with native browser events (e.g. Esc key)
  useEffect(() => {
    const syncFullscreen = () => {
      const isNativeFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      setChatState((prev) => {
        if (prev.isFullscreen === isNativeFull) return prev;
        return { ...prev, isFullscreen: isNativeFull };
      });
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  const updatePreferences = useCallback(async (prefs: any) => {
    if (!sessionId || !sessionToken) return;
    try {
      await apiService.submitPreferences(sessionId, sessionToken, prefs);
      setChatState((prev) => ({
        ...prev,
        gender: prefs.gender,
        lookingFor: prefs.looking_for,
        languages: prefs.languages,
        country: prefs.country,
        state: prefs.state,
        district: prefs.district,
        city: prefs.city,
        interestTags: prefs.interest_tags,
      }));
    } catch (error) {
      showToast('error', 'Failed to update preferences');
    }
  }, [sessionId, sessionToken, showToast]);

  const likePartner = useCallback(async () => {
    if (!sessionId || !sessionToken || !chatState.matchId) return;
    try {
      navigator.vibrate?.(15);
    } catch {}
    try {
      const result = await apiService.submitLike(sessionId, sessionToken, chatState.matchId);
      setChatState((prev) => {
        const newMessages = prev.messages ? [...prev.messages] : [];
        if (result.mutual) {
          const hasMutualMsg = newMessages.some((m) => m.id.startsWith('system-mutual-like'));
          if (!hasMutualMsg) {
            newMessages.push({
              id: 'system-mutual-like-' + Math.random().toString(),
              senderSessionId: 'system',
              message: '❤️ You both liked each other\nLooks like there\'s mutual interest.',
              createdAt: Date.now(),
            });
          }
        }
        return {
          ...prev,
          liked: true,
          mutualLike: result.mutual,
          messages: newMessages,
        };
      });
    } catch (error) {
      showToast('error', 'Failed to like partner');
    }
  }, [sessionId, sessionToken, chatState.matchId, showToast]);

  const sendChatMessage = useCallback(async (message: string) => {
    if (!sessionId || !sessionToken || !chatState.matchId) return;

    const tempId = Math.random().toString();
    const optimisticMessage = {
      id: tempId,
      senderSessionId: sessionId,
      message,
      createdAt: Date.now(),
      status: 'sending' as const,
    };

    // Optimistic insert
    setChatState((prev) => {
      const newMessages = prev.messages ? [...prev.messages] : [];
      newMessages.push(optimisticMessage);
      return { ...prev, messages: newMessages };
    });

    try {
      const msg = await apiService.submitChatMessage(sessionId, sessionToken, chatState.matchId, message);
      setChatState((prev) => {
        const updated = prev.messages
          ? prev.messages.map((m) => {
              if (m.id === tempId) {
                return {
                  ...m,
                  id: msg.id || m.id,
                  createdAt: new Date(msg.created_at).getTime(),
                  status: 'delivered' as const,
                };
              }
              return m;
            })
          : [];
        return { ...prev, messages: updated };
      });
    } catch (error) {
      showToast('error', 'Failed to send message');
      setChatState((prev) => {
        const updated = prev.messages ? prev.messages.filter((m) => m.id !== tempId) : [];
        return { ...prev, messages: updated };
      });
    }
  }, [sessionId, sessionToken, chatState.matchId, showToast]);

  const setTypingStatus = useCallback((typing: boolean) => {
    realtimeManager.sendTyping(typing);
  }, []);

  const setChatOpen = useCallback((open: boolean) => {
    setChatState((prev) => {
      if (open && prev.matchId && prev.partnerSessionId) {
        realtimeManager.sendSeenStatus(prev.matchId, prev.partnerSessionId);
      }
      return {
        ...prev,
        isChatOpen: open,
        unreadCount: open ? 0 : prev.unreadCount,
      };
    });
  }, []);

  const pauseQueue = useCallback(async () => {
    if (!sessionId || !sessionToken) return;
    try {
      setQueuePaused(true);
      await realtimeManager.leaveQueue(sessionId, sessionToken);
    } catch (err) {
      console.error('Failed to pause queue:', err);
    }
  }, [sessionId, sessionToken, setQueuePaused]);

  const resumeQueue = useCallback(async () => {
    if (!sessionId || !sessionToken || !callbacksRef.current) return;
    try {
      setQueuePaused(false);
      await realtimeManager.joinQueue(sessionId, sessionToken, callbacksRef.current);
    } catch (err) {
      console.error('Failed to resume queue:', err);
    }
  }, [sessionId, sessionToken, setQueuePaused]);

  const broadcastSkipPending = useCallback(() => {
    realtimeManager.sendSkipPending();
  }, []);

  const broadcastSkipCancelled = useCallback(() => {
    realtimeManager.sendSkipCancelled();
  }, []);

  const handleSendReaction = useCallback((emoji: string) => {
    if (matchIdRef.current && sessionIdRef.current) {
      realtimeManager.sendReaction(emoji, matchIdRef.current, sessionIdRef.current);
    }
  }, []);

  return {
    chatState,
    localStream,
    remoteStream,
    startChat,
    stopChat,
    handleNext,
    toggleMute,
    toggleCamera,
    toggleFullscreen,
    updatePreferences,
    likePartner,
    sendChatMessage,
    setTypingStatus,
    setChatOpen,
    sendReaction: handleSendReaction,
    isQueuePaused,
    pauseQueue,
    resumeQueue,
    broadcastSkipPending,
    broadcastSkipCancelled,
  };
}
