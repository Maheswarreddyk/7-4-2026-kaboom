export const MATCH_WEIGHTS = {
  mutualPreference: Number(process.env.WEIGHT_MUTUAL_PREFERENCE || 50),
  languagePerMatch: Number(process.env.WEIGHT_LANGUAGE_PER_MATCH || 20),
  languageMax: Number(process.env.WEIGHT_LANGUAGE_MAX || 40),
  city: Number(process.env.WEIGHT_CITY || 40),
  district: Number(process.env.WEIGHT_DISTRICT || 35),
  state: Number(process.env.WEIGHT_STATE || 30),
  country: Number(process.env.WEIGHT_COUNTRY || 20),
  interestPerMatch: Number(process.env.WEIGHT_INTEREST_PER_MATCH || 5),
  interestMax: Number(process.env.WEIGHT_INTEREST_MAX || 40),
  waitingPerSecond: Number(process.env.WEIGHT_WAITING_PER_SECOND || 1),
  waitingMax: Number(process.env.WEIGHT_WAITING_MAX || 60),
  recentPartnerPenalty: Number(process.env.WEIGHT_RECENT_PARTNER_PENALTY || 100),
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
