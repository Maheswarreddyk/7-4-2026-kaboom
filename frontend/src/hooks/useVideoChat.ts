import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext.js';
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
};

export function useVideoChat(
  sessionId: string | null,
  sessionToken: string | null,
  onReaction?: (emoji: string) => void
) {
  const { showToast } = useToast();
  const [chatState, setChatState] = useState<ChatState>(initialChatState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const partnerSessionIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const callbacksRef = useRef<ReturnType<typeof buildCallbacks> | null>(null);
  const offerRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipInProgressRef = useRef(false);
  
  // Phase 2: Ref to prevent stale closures in callbacks (specifically onOffer collision logic)
  const isInitiatorRef = useRef<boolean>(false);

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

  const setSignalingState = useCallback((state: SessionStatus) => {
    // Validate state transition to prevent illegal transitions
    const current = signalingStateRef.current;
    if (current === state) return;

    console.log(`[FSM Transition] ${current} -> ${state}`);
    signalingStateRef.current = state;
    setChatState((prev) => ({ ...prev, status: state }));
  }, []);

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

  const updateChatState = useCallback((updates: Partial<ChatState>) => {
    setChatState((prev) => ({ ...prev, ...updates }));
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
          setSignalingState('CONNECTED');
          playConnectChime();
        } else if (state === 'failed') {
          showToast('error', 'Connection failed. Retrying connection...');
          if (sessionIdRef.current && partnerSessionIdRef.current) {
            void handleIceRestart();
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
    }) => {
      if (skipInProgressRef.current) return;
      if (webrtcManager.getConnectionState() === 'connected') {
        console.log('[Signaling] Already connected. Ignoring duplicate matched event.');
        return;
      }

      partnerSessionIdRef.current = data.partnerSessionId;
      isInitiatorRef.current = data.isInitiator;
      setSignalingState('MATCH_FOUND');

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
      });
    },
    [updateChatState, setSignalingState]
  );

  const handleStartNegotiation = useCallback(
    async (data: {
      matchId: string;
      partnerSessionId: string;
      isInitiator: boolean;
      iceServers: { urls: string | string[] }[];
    }) => {
      if (skipInProgressRef.current) return;
      if (webrtcManager.getConnectionState() === 'connected') {
        console.log('[Signaling] Already connected. Ignoring duplicate startNegotiation event.');
        return;
      }

      partnerSessionIdRef.current = data.partnerSessionId;
      isInitiatorRef.current = data.isInitiator;

      clearSignalingRetryTimers();
      webrtcManager.setIceServers(data.iceServers);
      webrtcManager.createPeerConnection();
      setSignalingState('READY');

      updateChatState({
        connectionStatus: 'connecting',
        partnerSessionId: data.partnerSessionId,
        matchId: data.matchId,
        isInitiator: data.isInitiator,
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
    [showToast, updateChatState, clearSignalingRetryTimers, setSignalingState]
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
      await joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      setSignalingState('SEARCHING');
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
  }, [clearSignalingRetryTimers, updateChatState, setSignalingState]);

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
        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Ignoring duplicate matched event.');
          return;
        }
        handleMatched(data);
      },
      onStartNegotiation: (data: any) => {
        if (skipInProgressRef.current) return;
        if (webrtcManager.getConnectionState() === 'connected') {
          console.log('[Signaling] Already connected. Ignoring duplicate startNegotiation event.');
          return;
        }
        handleStartNegotiation(data);
      },
      onPartnerLeft: () => {
        if (skipInProgressRef.current) return;
        setSignalingState('PARTNER_LEFT');
        showToast('info', 'Partner left. Finding someone new...');
        // Auto-rejoin after the reconnect delay (500ms)
        setTimeout(() => {
          void triggerAutoRejoin();
        }, 500);
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
      onOffer: async (data: { fromSessionId: string; offer: RTCSessionDescriptionInit }) => {
        if (skipInProgressRef.current) return;
        if (webrtcManager.getConnectionState() === 'connected') return;

        if (sessionIdRef.current) {
          sendOfferAck(sessionIdRef.current);
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
        if (webrtcManager.getConnectionState() === 'connected') return;

        if (sessionIdRef.current) {
          sendAnswerAck(sessionIdRef.current);
        }

        const state = signalingStateRef.current;
        if (state === 'CONNECTED') {
          console.log('[Signaling] Already stable. Ignoring duplicate answer.');
          return;
        }

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
      setSignalingState('SEARCHING');
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
    disconnectRealtime();
    webrtcManager.cleanup();
    setLocalStream(null);
    setRemoteStream(null);
    setChatState(initialChatState);
    partnerSessionIdRef.current = null;
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
    setChatState((prev) => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  }, []);

  // Queue Polling Heartbeat: Runs ONLY when searching/waiting
  useEffect(() => {
    if (
      chatState.status !== 'SEARCHING' ||
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
  }, [chatState.status, sessionId, sessionToken]);

  // Mobile Lifecycle Event Listeners: visibilitychange, pagehide, freeze/resume, online/offline
  useEffect(() => {
    const API_BASE = environment.apiUrl;

    const handleUnloadOrHide = (e?: Event) => {
      console.log(`[Lifecycle] Event: ${e?.type || 'manual'} | sessionId=${sessionIdRef.current}`);
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
          void notifyDisconnect(sessionIdRef.current, sessionTokenRef.current, 'disconnect');
        }
      }
    };

    const handleResumeOrFocus = () => {
      console.log('[Lifecycle] App resumed or focused');
      // Self-healing queue: If status is SEARCHING, send a heartbeat joinQueue immediately
      if (signalingStateRef.current === 'SEARCHING' && sessionIdRef.current && sessionTokenRef.current && callbacksRef.current) {
        console.log('[Lifecycle] Queue active — forcing immediate heartbeat registration');
        void joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      }
    };

    const handleOnline = () => {
      console.log('[Lifecycle] Internet connection restored');
      if (signalingStateRef.current === 'SEARCHING' && sessionIdRef.current && sessionTokenRef.current && callbacksRef.current) {
        void joinQueue(sessionIdRef.current, sessionTokenRef.current, callbacksRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleUnloadOrHide();
      } else {
        handleResumeOrFocus();
      }
    };

    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', handleUnloadOrHide);
    document.addEventListener('resume', handleResumeOrFocus);
    window.addEventListener('focus', handleResumeOrFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      window.removeEventListener('pagehide', handleUnloadOrHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('freeze', handleUnloadOrHide);
      document.removeEventListener('resume', handleResumeOrFocus);
      window.removeEventListener('focus', handleResumeOrFocus);
      window.removeEventListener('online', handleOnline);
      
      clearSignalingRetryTimers();
      webrtcManager.cleanup();
      disconnectRealtime();
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
    try {
      const msg = await apiService.submitChatMessage(sessionId, sessionToken, chatState.matchId, message);
      setChatState((prev) => {
        const newMessages = prev.messages ? [...prev.messages] : [];
        newMessages.push({
          id: Math.random().toString(),
          senderSessionId: sessionId,
          message,
          createdAt: new Date(msg.created_at).getTime(),
        });
        return { ...prev, messages: newMessages };
      });
    } catch (error) {
      showToast('error', 'Failed to send message');
    }
  }, [sessionId, sessionToken, chatState.matchId, showToast]);

  const setTypingStatus = useCallback((typing: boolean) => {
    sendTyping(typing);
  }, []);

  const setChatOpen = useCallback((open: boolean) => {
    setChatState((prev) => ({
      ...prev,
      isChatOpen: open,
      unreadCount: open ? 0 : prev.unreadCount,
    }));
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
  };
}
