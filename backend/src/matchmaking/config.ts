import { environment } from 'config';

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
