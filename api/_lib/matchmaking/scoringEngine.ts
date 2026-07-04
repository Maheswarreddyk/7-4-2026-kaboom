import {
  getMinScoreThreshold,
  getRelaxationPhase,
  MATCH_WEIGHTS,
  type RelaxationPhase,
} from './config.js';

export interface SessionProfile {
  id: string;
  gender?: string | null;
  looking_for?: string[] | null;
  languages?: string[] | null;
  country?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  interest_tags?: string[] | null;
  queue_entered_at?: string | null;
  last_partner?: string | null;
  status?: string;
}

export interface ScoreResult {
  rawScore: number;
  weightedScore: number;
  reason: string;
  threshold: number;
  phase: RelaxationPhase;
  rank: number;
  passesThreshold: boolean;
}

function scoreMutualPreference(self: SessionProfile, partner: SessionProfile): { points: number; note: string } {
  const selfWants =
    !self.looking_for ||
    self.looking_for.length === 0 ||
    self.looking_for.includes('Anyone') ||
    (partner.gender && self.looking_for.includes(partner.gender));
  const partnerWants =
    !partner.looking_for ||
    partner.looking_for.length === 0 ||
    partner.looking_for.includes('Anyone') ||
    (self.gender && partner.looking_for.includes(self.gender));

  if (selfWants && partnerWants) {
    return { points: MATCH_WEIGHTS.mutualPreference, note: `Mutual Preference (+${MATCH_WEIGHTS.mutualPreference})` };
  }
  return { points: 0, note: '' };
}

function scoreLanguages(
  self: SessionProfile,
  partner: SessionProfile,
  phase: RelaxationPhase
): { points: number; note: string } {
  if (phase === 'relax_language' || phase === 'relax_location' || phase === 'random') {
    return { points: 0, note: '' };
  }
  if (!self.languages || !partner.languages) return { points: 0, note: '' };
  const shared = self.languages.filter((l) => partner.languages!.includes(l));
  if (shared.length === 0) return { points: 0, note: '' };
  const pts = Math.min(shared.length * MATCH_WEIGHTS.languagePerMatch, MATCH_WEIGHTS.languageMax);
  return { points: pts, note: `Shared Languages (${shared.join(', ')}) (+${pts})` };
}

function scoreLocation(
  self: SessionProfile,
  partner: SessionProfile,
  phase: RelaxationPhase
): { points: number; note: string } {
  if (phase === 'relax_location' || phase === 'random') return { points: 0, note: '' };
  if (self.city && partner.city && self.city === partner.city) {
    return { points: MATCH_WEIGHTS.city, note: `Same City: ${self.city} (+${MATCH_WEIGHTS.city})` };
  }
  if (self.district && partner.district && self.district === partner.district) {
    return { points: MATCH_WEIGHTS.district, note: `Same District: ${self.district} (+${MATCH_WEIGHTS.district})` };
  }
  if (self.state && partner.state && self.state === partner.state) {
    return { points: MATCH_WEIGHTS.state, note: `Same State: ${self.state} (+${MATCH_WEIGHTS.state})` };
  }
  if (self.country && partner.country && self.country === partner.country) {
    return { points: MATCH_WEIGHTS.country, note: `Same Country: ${self.country} (+${MATCH_WEIGHTS.country})` };
  }
  return { points: 0, note: '' };
}

function scoreInterests(
  self: SessionProfile,
  partner: SessionProfile,
  phase: RelaxationPhase
): { points: number; note: string } {
  if (phase === 'relax_interests' || phase === 'relax_language' || phase === 'relax_location' || phase === 'random') {
    return { points: 0, note: '' };
  }
  if (!self.interest_tags || !partner.interest_tags) return { points: 0, note: '' };
  const shared = self.interest_tags.filter((i) => partner.interest_tags!.includes(i));
  if (shared.length === 0) return { points: 0, note: '' };
  const pts = Math.min(shared.length * MATCH_WEIGHTS.interestPerMatch, MATCH_WEIGHTS.interestMax);
  return { points: pts, note: `Common Interests: ${shared.join(', ')} (+${pts})` };
}

function scoreWaiting(partner: SessionProfile): { points: number; note: string } {
  if (!partner.queue_entered_at) return { points: 0, note: '' };
  const waitSec = Math.floor((Date.now() - new Date(partner.queue_entered_at).getTime()) / 1000);
  const pts = Math.min(Math.max(waitSec, 0), MATCH_WEIGHTS.waitingMax);
  if (pts <= 0) return { points: 0, note: '' };
  return { points: pts, note: `Waiting Bonus (+${pts})` };
}

export function calculateCompatibility(
  self: SessionProfile,
  partner: SessionProfile,
  waitingSeconds: number,
  recentPartners: Set<string>,
  reportedIds: Set<string>
): ScoreResult | null {
  if (partner.status === 'ended') return null;
  if (reportedIds.has(partner.id)) return null;
  if (partner.id === self.last_partner) return null;

  const phase = getRelaxationPhase(waitingSeconds);
  const threshold = getMinScoreThreshold(phase);

  const parts = [
    scoreMutualPreference(self, partner),
    scoreLanguages(self, partner, phase),
    scoreLocation(self, partner, phase),
    scoreInterests(self, partner, phase),
    scoreWaiting(partner),
  ];

  let rawScore = parts.reduce((sum, p) => sum + p.points, 0);
  const reasons = parts.map((p) => p.note).filter(Boolean);

  if (recentPartners.has(partner.id)) {
    rawScore -= MATCH_WEIGHTS.recentPartnerPenalty;
    reasons.push(`Matched Recently (-${MATCH_WEIGHTS.recentPartnerPenalty})`);
  }

  const weightedScore = rawScore;
  const passesThreshold = phase === 'random' ? true : weightedScore >= threshold;

  return {
    rawScore,
    weightedScore,
    reason: reasons.join(', ') || 'No preference overlap',
    threshold,
    phase,
    rank: 0,
    passesThreshold,
  };
}

export function rankCandidates(
  scores: Array<ScoreResult & { sessionId: string }>,
  waitingSeconds: number
): Array<ScoreResult & { sessionId: string }> {
  const phase = getRelaxationPhase(waitingSeconds);
  const filtered =
    phase === 'random' ? scores : scores.filter((s) => s.passesThreshold);

  filtered.sort((a, b) => b.weightedScore - a.weightedScore);
  return filtered.map((s, i) => ({ ...s, rank: i + 1 }));
}
