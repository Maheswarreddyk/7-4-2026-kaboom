import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase.js';
import type { IceServerConfig } from '../types/index.js';
import { environment } from 'config';

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
  onPartnerLeft?: (data: { reason: string }) => void;
  onSearching?: (data: { message: string }) => void;
  onError?: (data: { message: string }) => void;
  onOffer?: (data: { fromSessionId: string; offer: RTCSessionDescriptionInit }) => void;
  onOfferAck?: (data: { fromSessionId: string }) => void;
  onAnswer?: (data: { fromSessionId: string; answer: RTCSessionDescriptionInit }) => void;
  onAnswerAck?: (data: { fromSessionId: string }) => void;
  onIceCandidate?: (data: { fromSessionId: string; candidate: RTCIceCandidateInit }) => void;
  onPartnerLiked?: (data: { matchId: string }) => void;
  onMutualLike?: (data: { matchId: string; partnerSessionId: string }) => void;
  onNewMessage?: (data: { matchId: string; senderSessionId: string; message: string; createdAt: string }) => void;
  onPartnerTyping?: (data: { typing: boolean }) => void;
  onReaction?: (data: { emoji: string }) => void;
  onMessageSeen?: (data: { matchId: string; senderId: string }) => void;
  onPartnerSkipPending?: () => void;
  onPartnerSkipCancelled?: () => void;
}

let sessionChannel: RealtimeChannel | null = null;
let matchChannel: RealtimeChannel | null = null;
let currentMatchId: string | null = null;

const API_BASE = environment.apiUrl;

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
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
    throw new Error(errorMsg);
  }

  if (!contentType.includes('application/json')) {
    return {} as T;
  }
  return response.json();
}

function cleanupMatchChannel() {
  const supabase = getSupabaseClient();
  if (matchChannel && supabase) {
    supabase.removeChannel(matchChannel);
    matchChannel = null;
  }
  currentMatchId = null;
}

function subscribeToMatchChannel(matchId: string, callbacks: RealtimeCallbacks): Promise<void> {
  const supabase = getSupabaseClient();

  cleanupMatchChannel();
  currentMatchId = matchId;

  return new Promise<void>((resolve) => {
    if (!supabase) {
      resolve();
      return;
    }

    // Phase 1 fix: Track whether we subscribed successfully so the timeout
    // fallback never fires after a real subscription (prevents premature resolution).
    let subscribed = false;
    // Phase 1 fix: 5000ms timeout — was 1500ms. Mobile cellular can take 2–4s to subscribe.
    // Firing too early caused offers to be sent before the answerer had a channel to receive them.
    const SUBSCRIBE_TIMEOUT_MS = 5_000;

    matchChannel = supabase
      .channel(`match:${matchId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        callbacks.onOffer?.(payload as { fromSessionId: string; offer: RTCSessionDescriptionInit });
      })
      .on('broadcast', { event: 'offer_ack' }, ({ payload }) => {
        callbacks.onOfferAck?.(payload as { fromSessionId: string });
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        callbacks.onAnswer?.(payload as { fromSessionId: string; answer: RTCSessionDescriptionInit });
      })
      .on('broadcast', { event: 'answer_ack' }, ({ payload }) => {
        callbacks.onAnswerAck?.(payload as { fromSessionId: string });
      })
      .on('broadcast', { event: 'ice_candidate' }, ({ payload }) => {
        callbacks.onIceCandidate?.(payload as { fromSessionId: string; candidate: RTCIceCandidateInit });
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        callbacks.onPartnerTyping?.(payload as { typing: boolean });
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        callbacks.onReaction?.(payload as { emoji: string });
      })
      .on('broadcast', { event: 'skip_pending' }, () => {
        callbacks.onPartnerSkipPending?.();
      })
      .on('broadcast', { event: 'skip_cancelled' }, () => {
        callbacks.onPartnerSkipCancelled?.();
      });

    const subscribeTimeout = setTimeout(() => {
      if (!subscribed) {
        console.warn(`[Realtime] Match channel ${matchId} subscribe timeout after ${SUBSCRIBE_TIMEOUT_MS}ms — proceeding`);
        resolve();
      }
    }, SUBSCRIBE_TIMEOUT_MS);

    matchChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(subscribeTimeout);
        subscribed = true;
        console.log(`[Realtime] Subscribed to match channel: ${matchId}`);
        resolve();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(subscribeTimeout);
        console.warn(`[Realtime] Match channel ${matchId} status: ${status} — resolving with fallback`);
        resolve();
      }
    });
  });
}

export function sendReaction(emoji: string) {
  matchChannel?.send({
    type: 'broadcast',
    event: 'reaction',
    payload: { emoji },
  });
}

export function sendSkipPending() {
  matchChannel?.send({
    type: 'broadcast',
    event: 'skip_pending',
    payload: {},
  });
}

export function sendSkipCancelled() {
  matchChannel?.send({
    type: 'broadcast',
    event: 'skip_cancelled',
    payload: {},
  });
}

export function connectRealtime(
  sessionId: string,
  sessionToken: string,
  callbacks: RealtimeCallbacks
): void {
  const supabase = getSupabaseClient();

  disconnectRealtime();

  sessionChannel = supabase
    .channel(`session:${sessionId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'matched' }, ({ payload }) => {
      const data = payload as {
        matchId: string;
        partnerSessionId: string;
        isInitiator: boolean;
        iceServers: IceServerConfig[];
        partnerProfile?: any;
        matchReasonMetadata?: any;
      };
      void (async () => {
        await subscribeToMatchChannel(data.matchId, callbacks);
        callbacks.onMatched?.(data);
        await markReady(sessionId, sessionToken, data.matchId);
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
        await subscribeToMatchChannel(data.matchId, callbacks);
        callbacks.onStartNegotiation?.(data);
      })();
    })
    .on('broadcast', { event: 'partner_left' }, ({ payload }) => {
      cleanupMatchChannel();
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
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[Realtime] Session channel error: ${status}`);
        callbacks.onError?.({ message: 'Signaling connection lost. Reconnecting...' });
      }
    });
}

export function disconnectRealtime(): void {
  const supabase = getSupabaseClient();
  cleanupMatchChannel();

  if (sessionChannel && supabase) {
    supabase.removeChannel(sessionChannel);
    sessionChannel = null;
  }
}

export async function joinQueue(sessionId: string, sessionToken: string, callbacks: RealtimeCallbacks) {
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
    await subscribeToMatchChannel(matchId, callbacks);
    callbacks.onMatched?.({
      matchId,
      partnerSessionId: data.partnerSessionId as string,
      isInitiator: data.isInitiator as boolean,
      iceServers: data.iceServers as IceServerConfig[],
      partnerProfile: data.partnerProfile,
      matchReasonMetadata: data.matchReasonMetadata,
    });
    await markReady(sessionId, sessionToken, matchId);
  }
}

export async function markReady(sessionId: string, sessionToken: string, matchId: string) {
  await apiPost('/match/ready', { sessionId, sessionToken, matchId });
}

export async function leaveQueue(sessionId: string, sessionToken: string) {
  await apiPost('/match/leave', { sessionId, sessionToken });
}

export async function nextPartner(sessionId: string, sessionToken: string, callbacks: RealtimeCallbacks) {
  cleanupMatchChannel();

  const result = await apiPost<{ success: boolean; data: Record<string, unknown> }>('/match/next', {
    sessionId,
    sessionToken,
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
    await subscribeToMatchChannel(matchId, callbacks);
    callbacks.onMatched?.({
      matchId,
      partnerSessionId: data.partnerSessionId as string,
      isInitiator: data.isInitiator as boolean,
      iceServers: data.iceServers as IceServerConfig[],
      partnerProfile: data.partnerProfile,
      matchReasonMetadata: data.matchReasonMetadata,
    });
    await markReady(sessionId, sessionToken, matchId);
  }
}

export async function notifyDisconnect(sessionId: string, sessionToken: string, reason: string) {
  try {
    await apiPost('/match/disconnect', { sessionId, sessionToken, reason });
  } catch {
    // Best-effort on page unload
  }
}

export function sendOffer(fromSessionId: string, offer: RTCSessionDescriptionInit): void {
  matchChannel?.send({
    type: 'broadcast',
    event: 'offer',
    payload: { fromSessionId, offer },
  });
}

export function sendAnswer(fromSessionId: string, answer: RTCSessionDescriptionInit): void {
  matchChannel?.send({
    type: 'broadcast',
    event: 'answer',
    payload: { fromSessionId, answer },
  });
}

export function sendIceCandidate(fromSessionId: string, candidate: RTCIceCandidateInit): void {
  matchChannel?.send({
    type: 'broadcast',
    event: 'ice_candidate',
    payload: { fromSessionId, candidate },
  });
}

export function sendOfferAck(fromSessionId: string): void {
  matchChannel?.send({
    type: 'broadcast',
    event: 'offer_ack',
    payload: { fromSessionId },
  });
}

export function sendAnswerAck(fromSessionId: string): void {
  matchChannel?.send({
    type: 'broadcast',
    event: 'answer_ack',
    payload: { fromSessionId },
  });
}

export function getCurrentMatchId(): string | null {
  return currentMatchId;
}

export function sendTyping(typing: boolean): void {
  matchChannel?.send({
    type: 'broadcast',
    event: 'typing',
    payload: { typing },
  });
}

export function sendSeenStatus(matchId: string, senderId: string): void {
  matchChannel?.send({
    type: 'broadcast',
    event: 'message_seen',
    payload: { matchId, senderId },
  });
}
