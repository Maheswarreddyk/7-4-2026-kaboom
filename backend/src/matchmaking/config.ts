/** Configurable matchmaking weights and adaptive relaxation thresholds (seconds). */
export const MATCH_WEIGHTS = {
  mutualPreference: 50,
  languagePerMatch: 20,
  languageMax: 40,
  city: 40,
  district: 35,
  state: 30,
  country: 20,
  interestPerMatch: 5,
  interestMax: 40,
  waitingPerSecond: 1,
  waitingMax: 60,
  recentPartnerPenalty: 100,
} as const;

export const RELAXATION_THRESHOLDS = {
  strict: 15,
  relaxInterests: 30,
  relaxLanguage: 60,
  relaxLocation: 120,
  random: 120,
} as const;

export const RESERVATION_TIMEOUT_MS = 5000;
export const HEARTBEAT_STALE_MS = 12000;

export type RelaxationPhase =
  | 'strict'
  | 'relax_interests'
  | 'relax_language'
  | 'relax_location'
  | 'random';

export function getRelaxationPhase(waitingSeconds: number): RelaxationPhase {
  if (waitingSeconds <= RELAXATION_THRESHOLDS.strict) return 'strict';
  if (waitingSeconds <= RELAXATION_THRESHOLDS.relaxInterests) return 'relax_interests';
  if (waitingSeconds <= RELAXATION_THRESHOLDS.relaxLanguage) return 'relax_language';
  if (waitingSeconds <= RELAXATION_THRESHOLDS.relaxLocation) return 'relax_location';
  return 'random';
}

export function getMinScoreThreshold(phase: RelaxationPhase): number {
  switch (phase) {
    case 'strict':
      return 140;
    case 'relax_interests':
      return 110;
    case 'relax_language':
      return 80;
    case 'relax_location':
      return 50;
    case 'random':
      return Number.NEGATIVE_INFINITY;
  }
}
