import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase.js';
import type { IceServerConfig } from '../types/index.js';

export interface RealtimeCallbacks {
  onWaiting?: (data: { queuePosition: number; message: string }) => void;
  onMatched?: (data: {
    matchId: string;
    partnerSessionId: string;
    isInitiator: boolean;
    iceServers: IceServerConfig[];
    partnerProfile?: any;
    matchReasonMetadata?: any;
  }) => void;
  onStartNegotiation?: (data: {
    matchId: string;
    partnerSessionId: string;
    isInitiator: boolean;
    iceServers: IceServerConfig[];
  }) => void;
  onSessionConnected?: (data: { matchId: string }) => void;
  onPartnerLeft?: (data: { reason: string }) => void;
  onSearching?: (data: { message: string }) => void;
  onError?: (data: { message: string }) => void;
  onOffer?: (data: { fromSessionId: string; offer: RTCSessionDescriptionInit; matchId: string }) => void;
  onOfferAck?: (data: { fromSessionId: string; matchId: string }) => void;
  onAnswer?: (data: { fromSessionId: string; answer: RTCSessionDescriptionInit; matchId: string }) => void;
  onAnswerAck?: (data: { fromSessionId: string; matchId: string }) => void;
  onIceCandidate?: (data: { fromSessionId: string; candidate: RTCIceCandidateInit; matchId: string }) => void;
  onPartnerLiked?: (data: { matchId: string }) => void;
  onMutualLike?: (data: { matchId: string; partnerSessionId: string }) => void;
  onNewMessage?: (data: { matchId: string; senderSessionId: string; message: string; createdAt: string }) => void;
  onPartnerTyping?: (data: { typing: boolean }) => void;
  onReaction?: (data: { emoji: string; matchId: string; senderSessionId: string }) => void;
  onMessageSeen?: (data: { matchId: string; senderId: string }) => void;
  onPartnerSkipPending?: () => void;
  onPartnerSkipCancelled?: () => void;
  onPartnerReconnect?: () => void;
  onReconnect?: () => void;
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  console.log(`[API_POST] Sending POST to: ${API_BASE}/api${path}`);
  const response = await fetch(`${API_BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    if (contentType.includes('application/json')) {
      try {
        const errBody = await response.json();
        errorMsg = errBody.error || errorMsg;
      } catch {}
    }
    const err: any = new Error(errorMsg);
    err.status = response.status;
    throw err;
  }

  if (!contentType.includes('application/json')) {
    return {} as T;
  }
  return response.json();
}

export class RealtimeManager {
  private sessionChannel: RealtimeChannel | null = null;
  private matchChannel: RealtimeChannel | null = null;
  private currentMatchId: string | null = null;
  private isMatchChannelConnected = false;
  private isSubscribing = false;

  leaveMatchChannel() {
    const supabase = getSupabaseClient();
    if (this.matchChannel && supabase) {
      supabase.removeChannel(this.matchChannel);
      this.matchChannel = null;
    }
    this.currentMatchId = null;
    this.isMatchChannelConnected = false;
  }

  subscribeToMatchChannel(matchId: string, callbacks: RealtimeCallbacks): Promise<boolean> {
    if (this.currentMatchId === matchId && this.isMatchChannelConnected) {
      console.log(`[Realtime] Already connected to match ${matchId}. Skipping redundant subscription.`);
      return Promise.resolve(true);
    }

    if (this.isSubscribing) {
      console.log(`[Realtime] Subscription already in progress. Skipping redundant call for ${matchId}.`);
      return Promise.resolve(false);
    }

    this.isSubscribing = true;
    const supabase = getSupabaseClient();

    this.leaveMatchChannel();
    this.currentMatchId = matchId;

    return new Promise<boolean>((resolve) => {
      let timeoutFired = false;
      const resolveAndUnlock = (success: boolean) => {
        this.isSubscribing = false;
        resolve(success);
      };

      if (!supabase) {
        resolveAndUnlock(false);
        return;
      }

      let subscribed = false;
      const SUBSCRIBE_TIMEOUT_MS = 5_000;

      this.matchChannel = supabase
        .channel(`match:${matchId}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'offer' }, ({ payload }) => {
          callbacks.onOffer?.({ ...(payload as any), matchId });
        })
        .on('broadcast', { event: 'offer_ack' }, ({ payload }) => {
          callbacks.onOfferAck?.({ ...(payload as any), matchId });
        })
        .on('broadcast', { event: 'answer' }, ({ payload }) => {
          callbacks.onAnswer?.({ ...(payload as any), matchId });
        })
        .on('broadcast', { event: 'answer_ack' }, ({ payload }) => {
          callbacks.onAnswerAck?.({ ...(payload as any), matchId });
        })
        .on('broadcast', { event: 'ice_candidate' }, ({ payload }) => {
          callbacks.onIceCandidate?.({ ...(payload as any), matchId });
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          callbacks.onPartnerTyping?.(payload as { typing: boolean });
        })
        .on('broadcast', { event: 'reaction' }, ({ payload }) => {
          callbacks.onReaction?.(payload as { emoji: string; matchId: string; senderSessionId: string });
        })
        .on('broadcast', { event: 'skip_pending' }, () => {
          callbacks.onPartnerSkipPending?.();
        })
        .on('broadcast', { event: 'skip_cancelled' }, () => {
          callbacks.onPartnerSkipCancelled?.();
        })
        .on('broadcast', { event: 'reconnect' }, () => {
          callbacks.onPartnerReconnect?.();
        });

      const subscribeTimeout = setTimeout(() => {
        if (!subscribed) {
          timeoutFired = true;
          console.warn(`[Realtime] Match channel ${matchId} subscribe timeout after ${SUBSCRIBE_TIMEOUT_MS}ms — aborting subscription`);
          this.leaveMatchChannel(); 
          resolveAndUnlock(false);
        }
      }, SUBSCRIBE_TIMEOUT_MS);

      this.matchChannel?.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(subscribeTimeout);
          // FE-006 fix: explicitly abort if timeout already fired
          if (timeoutFired) {
            console.warn(`[Realtime] Match channel ${matchId} subscribed successfully, but timeout already fired. Aborting late subscription.`);
            this.leaveMatchChannel();
            return;
          }
          subscribed = true;
          this.isMatchChannelConnected = true;
          console.log(`[Realtime] Subscribed to match channel: ${matchId}`);
          resolveAndUnlock(true);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(subscribeTimeout);
          this.isMatchChannelConnected = false;
          console.warn(`[Realtime] Match channel ${matchId} status: ${status} — aborting subscription`);
          resolveAndUnlock(false);
        }
      });
    });
  }

  async ensureMatchChannelConnected(matchId: string, callbacks: RealtimeCallbacks): Promise<void> {
    if (this.isMatchChannelConnected) {
      return;
    }
    console.log('[Realtime] Match channel disconnected. Re-subscribing before proceeding...');
    await this.subscribeToMatchChannel(matchId, callbacks);
  }

  sendReaction(emoji: string, matchId: string, senderSessionId: string) {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji, matchId, senderSessionId },
    });
  }

  sendSkipPending() {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'skip_pending',
      payload: {},
    });
  }

  sendSkipCancelled() {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'skip_cancelled',
      payload: {},
    });
  }

  sendReconnectPing() {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'reconnect',
      payload: {},
    });
  }

  async connectRealtime(
    sessionId: string,
    sessionToken: string,
    callbacks: RealtimeCallbacks,
    attempt = 1
  ): Promise<void> {
    const supabase = getSupabaseClient();

    this.disconnectRealtime();

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('WebSocket connection timed out'));
        }
      }, 5000);

      this.sessionChannel = supabase
        .channel(`session:${sessionId}`, { config: { broadcast: { self: false, ack: true } } })
        
      setInterval(() => {
        if (this.sessionChannel) {
          console.log(`[Realtime] Channel session:${sessionId} status is currently: ${this.sessionChannel.state}`);
        }
      }, 5000);

      this.sessionChannel
        .on('broadcast', { event: '*' }, (payload) => {
          console.log(`[Realtime] ⚡ received ANY broadcast:`, payload);
        })
        .on('broadcast', { event: 'ping' }, (payload) => {
          console.log(`[Realtime] 🏓 PING RECEIVED!`, payload);
        })
        .on('broadcast', { event: 'matched' }, ({ payload }) => {
          console.log(`[Realtime] 🔥 matched event fired for session! Payload:`, payload);
          const data = payload as {
            matchId: string;
            partnerSessionId: string;
            isInitiator: boolean;
            iceServers: IceServerConfig[];
            partnerProfile?: any;
            matchReasonMetadata?: any;
          };
          void (async () => {
            const subscribed = await this.subscribeToMatchChannel(data.matchId, callbacks);
            if (subscribed) {
              callbacks.onMatched?.(data);
              await this.markReady(sessionId, sessionToken, data.matchId);
            } else {
              callbacks.onError?.({ message: 'Failed to subscribe to match channel.' });
            }
          })();
        })
        .on('broadcast', { event: 'start_negotiation' }, ({ payload }) => {
          const data = payload as {
            matchId: string;
            partnerSessionId: string;
            isInitiator: boolean;
            iceServers: IceServerConfig[];
          };
          void (async () => {
            const subscribed = await this.subscribeToMatchChannel(data.matchId, callbacks);
            if (subscribed) {
              callbacks.onStartNegotiation?.(data);
            }
          })();
        })
        .on('broadcast', { event: 'session_connected' }, ({ payload }) => {
          callbacks.onSessionConnected?.(payload as { matchId: string });
        })
        .on('broadcast', { event: 'partner_left' }, ({ payload }) => {
          this.leaveMatchChannel();
          callbacks.onPartnerLeft?.(payload as { reason: string });
        })
        .on('broadcast', { event: 'searching' }, ({ payload }) => {
          callbacks.onSearching?.(payload as { message: string });
        })
        .on('broadcast', { event: 'partner_liked' }, ({ payload }) => {
          callbacks.onPartnerLiked?.(payload as { matchId: string });
        })
        .on('broadcast', { event: 'mutual_like' }, ({ payload }) => {
          callbacks.onMutualLike?.(payload as { matchId: string; partnerSessionId: string });
        })
        .on('broadcast', { event: 'new_message' }, ({ payload }) => {
          callbacks.onNewMessage?.(payload as { matchId: string; senderSessionId: string; message: string; createdAt: string });
        })
        .on('broadcast', { event: 'partner_typing' }, ({ payload }) => {
          callbacks.onPartnerTyping?.(payload as { typing: boolean });
        })
        .on('broadcast', { event: 'message_seen' }, ({ payload }) => {
          callbacks.onMessageSeen?.(payload as { matchId: string; senderId: string });
        })
        .subscribe((status) => {
          console.log(`[Realtime] Session channel status: ${status}`);
          if (status === 'SUBSCRIBED') {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            } else {
              // Reconnect case
              callbacks.onReconnect?.();
            }
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime] Session channel error (attempt ${attempt}): ${status}`);
            if (!resolved) {
              if (attempt < 3) {
                console.log(`[Realtime] Retrying connection (attempt ${attempt + 1})...`);
                this.disconnectRealtime();
                clearTimeout(timeout);
                this.connectRealtime(sessionId, sessionToken, callbacks, attempt + 1)
                  .then(resolve)
                  .catch(reject);
              } else {
                resolved = true;
                clearTimeout(timeout);
                reject(new Error(`Signaling connection error after 3 attempts: ${status}`));
              }
            } else {
              callbacks.onError?.({ message: 'Signaling connection lost. Reconnecting...' });
            }
          }
        });
    });
  }

  disconnectRealtime(): void {
    const supabase = getSupabaseClient();
    this.leaveMatchChannel();

    if (this.sessionChannel && supabase) {
      supabase.removeChannel(this.sessionChannel);
      this.sessionChannel = null;
    }
  }

  private isJoiningQueue = false;

  async joinQueue(sessionId: string, sessionToken: string, callbacks: RealtimeCallbacks) {
    if (this.isJoiningQueue) return;
    this.isJoiningQueue = true;
    try {
      const result = await apiPost<{ success: boolean; data: Record<string, unknown> }>('/match/join', {
        sessionId,
        sessionToken,
      });
    const data = result.data;

    if (data.status === 'waiting') {
      callbacks.onWaiting?.({
        queuePosition: (data.queuePosition as number) ?? 1,
        message: (data.message as string) ?? 'Waiting for a partner...',
      });
      return;
    }

    if (data.status === 'matched') {
      const matchId = data.matchId as string;
      const subscribed = await this.subscribeToMatchChannel(matchId, callbacks);
      if (subscribed) {
        callbacks.onMatched?.({
          matchId,
          partnerSessionId: data.partnerSessionId as string,
          isInitiator: data.isInitiator as boolean,
          iceServers: data.iceServers as IceServerConfig[],
          partnerProfile: data.partnerProfile,
          matchReasonMetadata: data.matchReasonMetadata,
        });
        await this.markReady(sessionId, sessionToken, matchId);
      } else {
        callbacks.onError?.({ message: 'Failed to subscribe to match channel.' });
      }
    }
    } finally {
      this.isJoiningQueue = false;
    }
  }

  async markReady(sessionId: string, sessionToken: string, matchId: string) {
    await apiPost('/match/ready', { sessionId, sessionToken, matchId });
  }

  async markMediaConnected(sessionId: string, sessionToken: string, matchId: string) {
    await apiPost('/match/connected', { sessionId, sessionToken, matchId });
  }

  async leaveQueue(sessionId: string, sessionToken: string, matchId?: string) {
    try {
      await apiPost('/match/leave', { sessionId, sessionToken, matchId });
    } catch (error: any) {
      if (error.status === 409) {
        console.warn('[Queue] 409 Conflict ignored during leaveQueue (matched concurrently).');
      }
    }
  }

  async nextPartner(sessionId: string, sessionToken: string, callbacks: RealtimeCallbacks, targetMatchId?: string, reason: string = 'next') {
    this.leaveMatchChannel();

    const result = await apiPost<{ success: boolean; data: Record<string, unknown> }>('/match/next', {
      sessionId,
      sessionToken,
      matchId: targetMatchId,
      reason,
    });

    const data = result.data;

    if (data.status === 'waiting') {
      callbacks.onWaiting?.({
        queuePosition: (data.queuePosition as number) ?? 1,
        message: 'Finding a new partner...',
      });
      return;
    }

    if (data.status === 'matched') {
      const matchId = data.matchId as string;
      const subscribed = await this.subscribeToMatchChannel(matchId, callbacks);
      if (subscribed) {
        callbacks.onMatched?.({
          matchId,
          partnerSessionId: data.partnerSessionId as string,
          isInitiator: data.isInitiator as boolean,
          iceServers: data.iceServers as IceServerConfig[],
          partnerProfile: data.partnerProfile,
          matchReasonMetadata: data.matchReasonMetadata,
        });
        await this.markReady(sessionId, sessionToken, matchId);
      } else {
        callbacks.onError?.({ message: 'Failed to subscribe to match channel.' });
      }
    }
  }

  async notifyDisconnect(sessionId: string, sessionToken: string, reason: string, matchId?: string) {
    try {
      await apiPost('/match/disconnect', { sessionId, sessionToken, reason, matchId });
    } catch {
      // Best-effort on page unload
    }
  }

  sendOffer(fromSessionId: string, offer: RTCSessionDescriptionInit): void {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'offer',
      payload: { fromSessionId, offer },
    });
  }

  sendAnswer(fromSessionId: string, answer: RTCSessionDescriptionInit): void {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'answer',
      payload: { fromSessionId, answer },
    });
  }

  sendIceCandidate(fromSessionId: string, candidate: RTCIceCandidateInit): void {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'ice_candidate',
      payload: { fromSessionId, candidate },
    });
  }

  sendOfferAck(fromSessionId: string): void {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'offer_ack',
      payload: { fromSessionId },
    });
  }

  sendAnswerAck(fromSessionId: string): void {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'answer_ack',
      payload: { fromSessionId },
    });
  }

  getCurrentMatchId(): string | null {
    return this.currentMatchId;
  }

  sendTyping(typing: boolean): void {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { typing },
    });
  }

  sendSeenStatus(matchId: string, senderId: string): void {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'message_seen',
      payload: { matchId, senderId },
    });
  }

  sendAbortMatch(matchId: string): void {
    this.matchChannel?.send({
      type: 'broadcast',
      event: 'abortMatch',
      payload: { matchId },
    });
  }
}

export const realtimeManager = new RealtimeManager();
