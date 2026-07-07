import { environment } from 'config';

// ============================================================
// Central Timing Constants
// All timing values come from here — no magic numbers anywhere.
// ============================================================

/** How long a queue heartbeat stays valid before a user is pruned from active candidates (ms) */
export const HEARTBEAT_STALE_MS = 45_000; // 45s — was 12s (too tight for mobile)

/** How long a reservation lock is held before expiring (ms) */
export const RESERVATION_TIMEOUT_MS = 20_000; // 20s signaling timeout as per V4.1 requirement

/** How long the WebRTC connection has to establish before returning users to queue (ms) */
export const WEBRTC_CONNECTION_TIMEOUT_MS = 15_000; // 15s connection timeout as per V4.1 requirement

/** Cooldown before allowing rematch with previous partner (ms) */
export const REMATE_COOLDOWN_MS = 15_000; // 15s rematch cooldown

/** How long the initiator retries sending an offer before giving up (ms) */
export const OFFER_TIMEOUT_MS = 30_000;

/** How long to wait for an answer ACK before retrying the answer (ms) */
export const ANSWER_TIMEOUT_MS = 30_000;

/** ICE gathering timeout — give up after this many ms and attempt ICE restart (ms) */
export const ICE_TIMEOUT_MS = 15_000;

/** How long a match can sit without negotiation_started before being considered zombie (ms) */
export const MATCH_NEGOTIATION_TIMEOUT_MS = 60_000;

/** Time between match scheduler cycles (ms) */
export const SCHEDULER_INTERVAL_MS = 1_500;

/** Delay before re-entering queue after partner leaves (ms) */
export const RECONNECT_DELAY_MS = 500;

// ============================================================
// Match Weights — all from environment
// ============================================================

export const MATCH_WEIGHTS = {
  mutualPreference:     environment.matchmaking.weights.mutualPreference,
  languagePerMatch:     environment.matchmaking.weights.languagePerMatch,
  languageMax:          environment.matchmaking.weights.languageMax,
  city:                 environment.matchmaking.weights.city,
  district:             environment.matchmaking.weights.district,
  state:                environment.matchmaking.weights.state,
  country:              environment.matchmaking.weights.country,
  interestPerMatch:     environment.matchmaking.weights.interestPerMatch,
  interestMax:          environment.matchmaking.weights.interestMax,
  waitingPerSecond:     environment.matchmaking.weights.waitingPerSecond,
  waitingMax:           environment.matchmaking.weights.waitingMax,
  recentPartnerPenalty: environment.matchmaking.weights.recentPartnerPenalty,
};

// ============================================================
// Relaxation Thresholds (waiting seconds before loosening filters)
// ============================================================

export const RELAXATION_THRESHOLDS = {
  strict: 5,
  relaxInterests: 10,
  relaxLanguage: 15,
  relaxLocation: 20,
  allowPrevious: 25,
  random: 25,
} as const;

export type RelaxationPhase =
  | 'strict'
  | 'relax_interests'
  | 'relax_language'
  | 'relax_location'
  | 'allow_previous'
  | 'random';

export function getRelaxationPhase(waitingSeconds: number): RelaxationPhase {
  if (waitingSeconds <= RELAXATION_THRESHOLDS.strict) return 'strict';
  if (waitingSeconds <= RELAXATION_THRESHOLDS.relaxInterests) return 'relax_interests';
  if (waitingSeconds <= RELAXATION_THRESHOLDS.relaxLanguage) return 'relax_language';
  if (waitingSeconds <= RELAXATION_THRESHOLDS.relaxLocation) return 'relax_location';
  if (waitingSeconds <= RELAXATION_THRESHOLDS.allowPrevious) return 'allow_previous';
  return 'random';
}

export function getMinScoreThreshold(phase: RelaxationPhase): number {
  switch (phase) {
    case 'strict':          return 140;
    case 'relax_interests': return 110;
    case 'relax_language':  return 80;
    case 'relax_location':  return 50;
    case 'allow_previous':  return 30;
    case 'random':          return Number.NEGATIVE_INFINITY;
  }
}
