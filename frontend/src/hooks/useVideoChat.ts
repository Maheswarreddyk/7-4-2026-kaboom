import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext.js';
import { useSession } from '../contexts/SessionContext.js';
import { apiService } from '../services/api.js';
import {
  connectRealtime,
  disconnectRealtime,
  joinQueue,
  leaveQueue,
  nextPartner,
  notifyDisconnect,
  sendAnswer,
  sendIceCandidate,
  sendOffer,
  sendTyping,
  sendOfferAck,
  sendAnswerAck,
  sendReaction,
  sendSeenStatus,
  sendSkipPending,
  sendSkipCancelled,
} from '../services/realtime.js';
import { webrtcManager } from '../webrtc/index.js';
import type { ChatState, ConnectionStatus, SessionStatus } from '../types/index.js';
import { environment } from 'config';

const initialChatState: ChatState = {
  status: 'IDLE',
  connectionStatus: 'disconnected',
  partnerSessionId: null,
  matchId: null,
  isInitiator: false,
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
  onReaction?: (emoji: string) => void
) {
  const { showToast } = useToast();
  const { updateSessionLifecycleState } = useSession();
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

  const playConnectChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const now = ctx.currentTime;
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      playTone(523.25, now, 0.6); // C5
      playTone(659.25, now + 0.1, 0.6); // E5
      playTone(783.99, now + 0.2, 0.8); // G5
    } catch (e) {
      console.warn('Audio context chime failed to play:', e);
    }
  }, []);

  const signalingStateRef = useRef<SessionStatus>('IDLE');
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
      const state = signalingStateRef.current;
      if (state !== 'CONNECTED' && state !== 'IDLE' && state !== 'ENDED') {
        console.warn(`[WebRTC Timeout] Connection did not establish within 15s (current status: ${state}). Re-entering queue...`);
        showToast('warning', 'Connection timed out. Finding someone else...');
        void triggerAutoRejoinRef.current();
      }
    }, 15000); // 15s timeout (V4.1 Requirement 14)
  }, [showToast, clearWebRTCTimeout]);

  const setSignalingState = useCallback((state: SessionStatus) => {
    const current = signalingStateRef.current;
    if (current === state) return;

    // V6.15: Transition Logger
    const logTime = new Date().toLocaleTimeString();
    const entry = `${logTime} ${current} -> ${state}`;
    transitionLogRef.current.push(entry);
    if (environment.nodeEnv === 'development') {
      console.log(`%c[FSM LOG] ${entry}`, 'color: #f59e0b; font-weight: bold;');
    }

    signalingStateRef.current = state;
    setChatState((prev) => ({ ...prev, status: state }));

    // Auto-clear timeout on stable or ended states
    if (state === 'CONNECTED' || state === 'IDLE' || state === 'ENDED') {
      clearWebRTCTimeout();

      // V6.15: Clear reconnect countdown on stable connection or exit
      setChatState((prev) => ({ ...prev, reconnectCountdown: null }));
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
    }

    // Session Lifecycle Manager updates
    let lifecycleState: 'CONNECTED' | 'QUEUE' | 'IDLE' | 'LEAVING' | 'DESTROYED' = 'IDLE';
    if (state === 'CONNECTED') {
      lifecycleState = 'CONNECTED';
    } else if ([
      'REQUESTING_MEDIA', 'MEDIA_READY', 'CONNECTING_REALTIME', 
      'SEARCHING', 'REQUEUEING', 'MATCH_FOUND', 'READY', 'NEGOTIATING', 'ICE_CONNECTING'
    ].includes(state)) {
      lifecycleState = 'QUEUE';
    } else if (state === 'ENDED' || state === 'PARTNER_LEFT') {
      lifecycleState = 'LEAVING';
    } else {
      lifecycleState = 'IDLE';
    }
    updateSessionLifecycleState(lifecycleState, matchIdRef.current, partnerSessionIdRef.current);
  }, [clearWebRTCTimeout, updateSessionLifecycleState]);

  const executePartnerLeftTeardown = useCallback(() => {
    setSignalingState('PARTNER_LEFT');
    setRemoteStream(null);
    webrtcManager.resetConnection();
    lastProcessedOfferSdpRef.current = null;
    lastProcessedAnswerSdpRef.current = null;
    
    showToast('info', 'Partner left. Finding someone new...');
    // Wait 2.5 seconds to show the left animation overlay, then automatically rejoin the queue
    setTimeout(() => {
      void triggerAutoRejoinRef.current();
    }, 2500);
  }, [showToast, setSignalingState]);

  const startReconnectCountdown = useCallback(() => {
    if (reconnectIntervalRef.current) return; // Already counting down

    if (partnerReconnectTimerRef.current) clearTimeout(partnerReconnectTimerRef.current);
    
    updateChatState({ connectionStatus: 'reconnecting', reconnectCountdown: 10 });

    let count = 10;
    reconnectIntervalRef.current = setInterval(() => {
      count -= 1;
      console.log(`[Grace Period Countdown] ${count}s remaining...`);
      updateChatState({ reconnectCountdown: count });

      if (count <= 0) {
        console.log('[Grace Period] Reconnect countdown expired. Cleaning up...');
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
          reconnectIntervalRef.current = null;
        }
        executePartnerLeftTeardown();
      }
    }, 1000);

    // Backup timer to ensure execution happens even if setInterval drifts
    partnerReconnectTimerRef.current = setTimeout(() => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      executePartnerLeftTeardown();
    }, 10500);
  }, [executePartnerLeftTeardown, updateChatState]);

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

  const handleIceRestart = useCallback(async () => {
    try {
      console.log('[WebRTC] Initiating ICE restart...');
      const offer = await webrtcManager.createOffer({ iceRestart: true });
      if (sessionIdRef.current) {
        sendOffer(sessionIdRef.current, offer);

        if (offerRetryTimerRef.current) clearInterval(offerRetryTimerRef.current);
        offerRetryTimerRef.current = setInterval(() => {
          console.log('[Signaling] ICE restart Offer ACK not received, retrying...');
          if (sessionIdRef.current) {
            sendOffer(sessionIdRef.current, offer);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('[WebRTC] ICE restart failed:', err);
    }
  }, []);

  const setupWebRTC = useCallback(async () => {
    webrtcManager.setCallbacks({
      onRemoteStream: (stream) => {
        if (partnerReconnectTimerRef.current) {
          clearTimeout(partnerReconnectTimerRef.current);
          partnerReconnectTimerRef.current = null;
        }
        setRemoteStream(stream);
        setSignalingState('CONNECTED');
        playConnectChime();
      },
      onConnectionStateChange: (state) => {
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
          setSignalingState('CONNECTED');
          playConnectChime();
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
      onIceCandidate: (candidate) => {
        const partnerId = partnerSessionIdRef.current;
        const fromSessionId = sessionIdRef.current;
        if (partnerId && fromSessionId) {
          sendIceCandidate(fromSessionId, candidate);
        }
      },
    });
  }, [showToast, updateChatState, handleIceRestart, playConnectChime, setSignalingState]);

  const handleMatched = useCallback(
    async (data: {
      matchId: string;
      partnerSessionId: string;
      isInitiator: boolean;
      iceServers: { urls: string | string[] }[];
      matchReasonMetadata?: any;
      partnerProfile?: any;
    }) => {
      if (skipInProgressRef.current) return;
      if (webrtcManager.getConnectionState() === 'connected') {
        console.log('[Signaling] Already connected. Ignoring duplicate matched event.');
        return;
      }

      // Play soft success ding
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now); // A5 note
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.4);
        }
      } catch (e) {
        console.warn('Audio success ding failed to play:', e);
      }

      partnerSessionIdRef.current = data.partnerSessionId;
      isInitiatorRef.current = data.isInitiator;
      setSignalingState('MATCH_FOUND');
      startWebRTCTimeout(); // V4.1 Requirement 14

      let existingMessages: any[] = [];
      try {
        const msgs = await apiService.getChatMessages(data.matchId);
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

        const myUni = localStorage.getItem('kaboom_university');
        const pUni = data.partnerProfile?.match_attributes?.university?.[0] || data.partnerProfile?.university;
        const matchedUni = details?.university || (myUni && pUni && myUni.toLowerCase() === pUni.toLowerCase() ? myUni : null);

        const myCity = localStorage.getItem('kaboom_city');
        const pCity = data.partnerProfile?.match_attributes?.city?.[0] || data.partnerProfile?.city;
        const matchedCity = details?.city || (myCity && pCity && myCity.toLowerCase() === pCity.toLowerCase() ? myCity : null);

        let myLanguages: string[] = [];
        try { myLanguages = JSON.parse(localStorage.getItem('kaboom_languages') || '[]'); } catch {}
        const pLanguages = data.partnerProfile?.match_attributes?.languages || data.partnerProfile?.languages || [];
        const sharedLanguages = myLanguages.filter(x => pLanguages.some((y: string) => y.toLowerCase() === x.toLowerCase()));
        const matchedLangsList = details?.languages || sharedLanguages;

        let myInterests: string[] = [];
        try { myInterests = JSON.parse(localStorage.getItem('kaboom_interest_tags') || '[]'); } catch {}
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
          const matchedState = details?.state || (localStorage.getItem('kaboom_state') === data.partnerProfile?.state ? data.partnerProfile?.state : null);
          const matchedCountry = details?.country || (localStorage.getItem('kaboom_country') === data.partnerProfile?.country ? data.partnerProfile?.country : null);
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

      updateChatState({
        connectionStatus: 'connecting',
        partnerSessionId: data.partnerSessionId,
        matchId: data.matchId,
        isInitiator: data.isInitiator,
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
    [updateChatState, setSignalingState, startWebRTCTimeout]
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
        isInitiator: data.isInitiator,
        partnerProfile: data.partnerProfile || null,
        matchReasonMetadata: data.matchReasonMetadata || null,
      });

      if (data.isInitiator) {
        try {
          setSignalingState('NEGOTIATING');
          const offer = await webrtcManager.createOffer();
          if (sessionIdRef.current) {
            sendOffer(sessionIdRef.current, offer);

            if (offerRetryTimerRef.current) clearInterval(offerRetryTimerRef.current);
            offerRetryTimerRef.current = setInterval(() => {
              console.log('[Signaling] Offer ACK not received, retrying offer...');
              if (sessionIdRef.current) {
                sendOffer(sessionIdRef.current, offer);
              }
            }, 2000);
          }
        } catch (error) {
          showToast('error', 'Failed to create connection offer');
          console.error(error);
        }
      }
    },
    [showToast, updateChatState, clearSignalingRetryTimers, setSignalingState, startWebRTCTimeout]
  );

  const triggerAutoRejoin = useCallback(async () => {
    if (!sessionIdRef.current || !sessionTokenRef.current || !callbacksRef.current) return;
    if (skipInProgressRef.current) return;

    skipInProgressRef.current = true;
    console.log('[Queue] Auto-rejoining queue...');
    setSignalingState('REQUEUEING');

    // Reset local/remote signaling states before re-entering queue
    clearSignalingRetryTimers();
    setRemoteStream(null);
    webrtcManager.resetConnection();
    lastProcessedOfferSdpRef.current = null;
    lastProcessedAnswerSdpRef.current = null;

    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

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
      await joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      setSignalingState('SEARCHING');
      console.log('[Lifecycle] Queue Joined');
    } catch (error) {
      console.error('[Queue] Auto-rejoin failed:', error);
      // Retry in 3 seconds if failed
      setTimeout(() => {
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
        if (skipInProgressRef.current) return;
        setSignalingState('SEARCHING');
        updateChatState({
          queuePosition: data.queuePosition,
          connectionStatus: 'connecting',
        });
      },
      onReaction: (data: { emoji: string }) => {
        if (skipInProgressRef.current) return;
        onReaction?.(data.emoji);
      },
      onMatched: (data: any) => {
        if (skipInProgressRef.current) return;
        if (data?.eventId && processedEventsRef.current.has(data.eventId)) {
          console.log('[Signaling] Duplicate matched event ignored. eventId:', data.eventId);
          return;
        }
        if (data?.eventId) processedEventsRef.current.add(data.eventId);

        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Ignoring duplicate matched event.');
          return;
        }
        handleMatched(data);
      },
      onStartNegotiation: (data: any) => {
        if (skipInProgressRef.current) return;
        if (data?.eventId && processedEventsRef.current.has(data.eventId)) {
          console.log('[Signaling] Duplicate startNegotiation event ignored. eventId:', data.eventId);
          return;
        }
        if (data?.eventId) processedEventsRef.current.add(data.eventId);

        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Ignoring duplicate startNegotiation event.');
          return;
        }
        handleStartNegotiation(data);
      },
      onPartnerLeft: (data?: { reason: string; eventId?: string }) => {
        if (skipInProgressRef.current) return;
        if (data?.eventId && processedEventsRef.current.has(data.eventId)) {
          console.log('[Signaling] Duplicate partner_left event ignored. eventId:', data.eventId);
          return;
        }
        if (data?.eventId) processedEventsRef.current.add(data.eventId);

        if (data?.reason === 'disconnect') {
          console.log('[Grace Period] Partner disconnected accidentally. Starting 10s grace period...');
          updateChatState({ partnerSkipPending: false });
          startReconnectCountdown();
          return;
        }

        executePartnerLeftTeardown();
      },
      onSearching: (data: { message: string }) => {
        if (skipInProgressRef.current) return;
        setSignalingState('SEARCHING');
        updateChatState({ connectionStatus: 'connecting' });
        showToast('info', data.message);
      },
      onError: (data: { message: string }) => {
        if (skipInProgressRef.current) return;
        showToast('error', data.message);

        if (data.message.includes('lost') || data.message.includes('Reconnecting')) {
          console.log('[Websocket Reconnect] Connection lost. Attempting automatic reconnection...');
          setTimeout(() => {
            void startChat();
          }, 3000);
        }
      },
      onPartnerLiked: () => {
        if (skipInProgressRef.current) return;
        updateChatState({ partnerLiked: true });
        showToast('success', 'Your partner liked you! ❤️');
      },
      onMutualLike: () => {
        if (skipInProgressRef.current) return;
        updateChatState({ mutualLike: true });
        showToast('success', "It's a Match! ❤️");
      },
      onPartnerSkipPending: () => {
        if (skipInProgressRef.current) return;
        updateChatState({ partnerSkipPending: true });
      },
      onPartnerSkipCancelled: () => {
        if (skipInProgressRef.current) return;
        updateChatState({ partnerSkipPending: false });
      },
      onNewMessage: (data: { matchId: string; senderSessionId: string; message: string; createdAt: string }) => {
        if (skipInProgressRef.current) return;
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
        if (skipInProgressRef.current) return;
        updateChatState({ partnerTyping: data.typing });
      },
      onMessageSeen: (data: { matchId: string; senderId: string }) => {
        if (skipInProgressRef.current) return;
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
      onOffer: async (data: { fromSessionId: string; offer: RTCSessionDescriptionInit }) => {
        if (skipInProgressRef.current) return;

        // Phase 3 fix: Always send ACK first so the remote peer stops retrying the offer,
        // even if we are already connected!
        if (sessionIdRef.current) {
          sendOfferAck(sessionIdRef.current);
        }

        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Sent offer ACK and ignored duplicate offer.');
          return;
        }

        const state = signalingStateRef.current;
        const isCollision = state === 'NEGOTIATING' || state === 'READY';
        const isPolite = !isInitiatorRef.current;

        if (isCollision) {
          if (!isPolite) {
            console.log('[Signaling] Offer collision. Impolite peer ignores remote offer.');
            return;
          }
          console.log('[Signaling] Offer collision. Polite peer accepts remote offer.');
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
            sendAnswer(sessionIdRef.current, answer);

            if (answerRetryTimerRef.current) clearInterval(answerRetryTimerRef.current);
            answerRetryTimerRef.current = setInterval(() => {
              console.log('[Signaling] Answer ACK not received, retrying answer...');
              if (sessionIdRef.current) {
                sendAnswer(sessionIdRef.current, answer);
              }
            }, 2000);
          }
        } catch (error) {
          showToast('error', 'Failed to handle connection offer');
          console.error(error);
        }
      },
      onOfferAck: () => {
        if (skipInProgressRef.current) return;
        console.log('[Signaling] Offer ACK received, clearing retry timer.');
        if (offerRetryTimerRef.current) {
          clearInterval(offerRetryTimerRef.current);
          offerRetryTimerRef.current = null;
        }
      },
      onAnswer: async (data: { answer: RTCSessionDescriptionInit }) => {
        if (skipInProgressRef.current) return;

        // Phase 3 fix: Always send ACK first so the remote peer stops retrying the answer,
        // even if we are already connected!
        if (sessionIdRef.current) {
          sendAnswerAck(sessionIdRef.current);
        }

        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Sent answer ACK and ignored duplicate answer.');
          return;
        }

        const state = signalingStateRef.current;
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
      onAnswerAck: () => {
        if (skipInProgressRef.current) return;
        console.log('[Signaling] Answer ACK received, clearing retry timer.');
        if (answerRetryTimerRef.current) {
          clearInterval(answerRetryTimerRef.current);
          answerRetryTimerRef.current = null;
        }
      },
      onIceCandidate: async (data: { candidate: RTCIceCandidateInit }) => {
        if (skipInProgressRef.current) return;
        if (webrtcManager.getConnectionState() === 'connected') return;
        await webrtcManager.addIceCandidate(data.candidate);
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
      connectRealtime(sessionId, sessionToken, callbacks);

      await joinQueue(sessionId, sessionToken, callbacks);
      if (signalingStateRef.current === 'CONNECTING_REALTIME') {
        setSignalingState('SEARCHING');
        console.log('[Lifecycle] Queue Joined');
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
  }, [sessionId, sessionToken, showToast, setupWebRTC, handleMatched, handleStartNegotiation, updateChatState, setSignalingState]);

  const stopChat = useCallback(async () => {
    clearSignalingRetryTimers();
    setSignalingState('ENDED');
    if (sessionIdRef.current && sessionTokenRef.current) {
      await notifyDisconnect(sessionIdRef.current, sessionTokenRef.current, 'leave');
    }
    await leaveQueue(sessionIdRef.current ?? '', sessionTokenRef.current ?? '').catch(() => {});
    console.log('[Lifecycle] Queue Left');
    disconnectRealtime();
    webrtcManager.cleanup();
    setLocalStream(null);
    setRemoteStream(null);
    lastProcessedOfferSdpRef.current = null;
    lastProcessedAnswerSdpRef.current = null;
    setChatState(initialChatState);
    partnerSessionIdRef.current = null;
    matchIdRef.current = null;
  }, [clearSignalingRetryTimers, setSignalingState]);

  const handleNext = useCallback(async () => {
    if (!sessionIdRef.current || !sessionTokenRef.current || !callbacksRef.current) return;
    if (skipInProgressRef.current) return;

    skipInProgressRef.current = true;
    console.log('[Queue] handleNext: switching to next partner...');
    setSignalingState('REQUEUEING');

    clearSignalingRetryTimers();
    setRemoteStream(null);
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
      await nextPartner(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      setSignalingState('SEARCHING');
    } catch (error) {
      console.error('Error switching to next partner:', error);
      showToast('error', 'Failed to find a new partner. Retrying...');
      void triggerAutoRejoin();
    } finally {
      skipInProgressRef.current = false;
    }
  }, [updateChatState, clearSignalingRetryTimers, setSignalingState, showToast, triggerAutoRejoin]);

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

        stats.forEach((report) => {
          if (report.type === 'remote-inbound-rtp' && report.roundTripTime) {
            rtt = report.roundTripTime * 1000;
          }
          if (report.type === 'inbound-rtp' && report.packetsLost) {
            packetsLost = report.packetsLost;
          }
        });

        let quality: 'excellent' | 'good' | 'poor' = 'excellent';
        if (rtt > 250 || packetsLost > 20) {
          quality = 'poor';
        } else if (rtt > 100 || packetsLost > 5) {
          quality = 'good';
        }

        updateChatState({ connectionQuality: quality });
      } catch (err) {
        console.warn('[WebRTC Stats] Failed to query stats:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [chatState.status, updateChatState]);

  // Queue Polling Heartbeat: Runs ONLY when searching/waiting
  useEffect(() => {
    if (
      chatState.status !== 'SEARCHING' ||
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
        await joinQueue(sessionId, sessionToken, callbacksRef.current!);
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
        await apiService.submitHeartbeat(sessionId, sessionToken);
      } catch (err) {
        console.warn('[Heartbeat] Active heartbeat failed:', err);
      }
    };

    // Send immediate heartbeat on connect, then tick every 20 seconds
    void runHeartbeat();
    activeHeartbeatIntervalRef.current = setInterval(runHeartbeat, 20000);

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

    const handleUnloadOrHide = (e?: Event) => {
      console.log(`[Lifecycle] Event: ${e?.type || 'manual'} | Releasing camera tracks.`);
      const activeStream = webrtcManager.getLocalStream();
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        (webrtcManager as any).localStream = null;
        setLocalStream(null);
      }

      if (sessionIdRef.current && sessionTokenRef.current && (e?.type === 'beforeunload' || e?.type === 'pagehide')) {
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
          void notifyDisconnect(sessionIdRef.current, sessionTokenRef.current, 'disconnect');
        }
      }
    };

    const handleResumeOrFocus = async () => {
      console.log('[Lifecycle] App resumed or focused. Re-acquiring camera tracks.');
      
      const isCallActive = [
        'REQUESTING_MEDIA', 'MEDIA_READY', 'CONNECTING_REALTIME', 
        'SEARCHING', 'REQUEUEING', 'PARTNER_LEFT', 'MATCH_FOUND', 'READY', 'NEGOTIATING', 'ICE_CONNECTING', 'CONNECTED'
      ].includes(signalingStateRef.current);

      if (isCallActive && !isQueuePausedRef.current) {
        try {
          const stream = await webrtcManager.getLocalMedia();
          setLocalStream(stream);
          
          // Rebind tracks to peer connection if it exists
          const pc = (webrtcManager as any).peerConnection;
          if (pc && pc.connectionState !== 'closed') {
            const senders = pc.getSenders();
            stream.getTracks().forEach((track) => {
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

      // Self-healing queue: If status is SEARCHING, send a heartbeat joinQueue immediately
      if (signalingStateRef.current === 'SEARCHING' && !isQueuePausedRef.current && sessionIdRef.current && sessionTokenRef.current && callbacksRef.current) {
        console.log('[Lifecycle] Queue active — forcing immediate heartbeat registration');
        void joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      }
    };

    const handleOnline = () => {
      console.log('[Lifecycle] Internet connection restored');
      if (signalingStateRef.current === 'SEARCHING' && !isQueuePausedRef.current && sessionIdRef.current && sessionTokenRef.current && callbacksRef.current) {
        void joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleUnloadOrHide();
      } else {
        void handleResumeOrFocus();
      }
    };

    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', handleUnloadOrHide);

    // Phase 4: Extract named handlers so removeEventListener can match the SAME reference.
    // Passing new arrow functions to removeEventListener never removes the original listener.
    const handleResume = () => void handleResumeOrFocus();
    const handleFocus = () => void handleResumeOrFocus();
    document.addEventListener('resume', handleResume);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      window.removeEventListener('pagehide', handleUnloadOrHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('freeze', handleUnloadOrHide);
      document.removeEventListener('resume', handleResume);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      
      clearSignalingRetryTimers();
      webrtcManager.cleanup();
      disconnectRealtime();
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
      setChatState((prev) => ({ ...prev, liked: true, mutualLike: result.mutual }));
      if (result.mutual) {
        showToast('success', "It's a Match! ❤️");
      }
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
    sendTyping(typing);
  }, []);

  const setChatOpen = useCallback((open: boolean) => {
    setChatState((prev) => {
      if (open && prev.matchId && prev.partnerSessionId) {
        sendSeenStatus(prev.matchId, prev.partnerSessionId);
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
      await leaveQueue(sessionId, sessionToken);
    } catch (err) {
      console.error('Failed to pause queue:', err);
    }
  }, [sessionId, sessionToken, setQueuePaused]);

  const resumeQueue = useCallback(async () => {
    if (!sessionId || !sessionToken || !callbacksRef.current) return;
    try {
      setQueuePaused(false);
      await joinQueue(sessionId, sessionToken, callbacksRef.current);
    } catch (err) {
      console.error('Failed to resume queue:', err);
    }
  }, [sessionId, sessionToken, setQueuePaused]);

  const broadcastSkipPending = useCallback(() => {
    sendSkipPending();
  }, []);

  const broadcastSkipCancelled = useCallback(() => {
    sendSkipCancelled();
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
    sendReaction,
    isQueuePaused,
    pauseQueue,
    resumeQueue,
    broadcastSkipPending,
    broadcastSkipCancelled,
  };
}
