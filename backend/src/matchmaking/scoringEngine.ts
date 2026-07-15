import {
  getMinScoreThreshold,
  getRelaxationPhase,
  MATCH_WEIGHTS,
  REMATE_COOLDOWN_MS,
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
  
  // V6 & V6.5 temporary profile fields
  display_name?: string | null;
  bio?: string | null;
  match_mode?: 'RANDOM' | 'PREFER' | 'STRICT' | null;
  match_constraints?: Record<string, boolean> | null;
  match_attributes?: Record<string, string[]> | null;
}

export interface ScoreResult {
  rawScore: number;
  weightedScore: number;
  reason: string;
  threshold: number;
  phase: RelaxationPhase;
  rank: number;
  passesThreshold: boolean;
  reasonMetadata?: {
    reason: 'strict_filters' | 'prefer_filters' | 'random';
    confidence: number;
    matchedBy: string[];
  };
}

function scoreMutualPreference(self: SessionProfile, partner: SessionProfile): { points: number; note: string } | null {
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
  return null;
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
  reportedIds: Set<string>,
  endedMatchesMap?: Map<string, string>
): ScoreResult | null {
  if (partner.status === 'ended') return null;
  if (reportedIds.has(partner.id)) return null;

  // 1. Evaluate Generic Constraints for STRICT mode
  const evaluateStrictConstraints = (user1: SessionProfile, user2: SessionProfile): boolean => {
    if (user1.match_mode !== 'STRICT') return true;
    const constraints = user1.match_constraints || {};
    for (const [key, isStrict] of Object.entries(constraints)) {
      if (!isStrict) continue;
      
      const val1 = user1.match_attributes?.[key] || [];
      const val2 = user2.match_attributes?.[key] || [];
      
      // Exact match required for strict constraints
      if (val1.length !== val2.length) return false;
      const exactMatch = val1.every(v => val2.includes(v));
      if (!exactMatch) {
        return false;
      }
    }
    return true;
  };

  // Both parties must satisfy each other's strict constraints
  if (!evaluateStrictConstraints(self, partner) || !evaluateStrictConstraints(partner, self)) {
    return null;
  }

  const phase = getRelaxationPhase(waitingSeconds);
  const threshold = getMinScoreThreshold(phase);

  // Check rematch cooldown logic
  const isPreviousPartner = partner.id === self.last_partner;
  if (isPreviousPartner) {
    if (phase !== 'allow_previous' && phase !== 'random') {
      return null;
    }
    
    const lastEndedAt = endedMatchesMap?.get(partner.id);
    if (lastEndedAt) {
      const elapsedMs = Date.now() - new Date(lastEndedAt).getTime();
      if (elapsedMs < REMATE_COOLDOWN_MS) {
        console.log(`[Scoring] Rematch blocked by cooldown: ${self.id} and ${partner.id} (${Math.round(elapsedMs / 1000)}s elapsed, min=${REMATE_COOLDOWN_MS / 1000}s)`);
        return null;
      }
    }
  }

  // Calculate scores
  const mutualPref = scoreMutualPreference(self, partner);
  if (!mutualPref) return null; // Hard block for gender mismatch

  const parts = [
    mutualPref,
    scoreLanguages(self, partner, phase),
    scoreLocation(self, partner, phase),
    scoreInterests(self, partner, phase),
    scoreWaiting(partner),
  ];

  let rawScore = parts.reduce((sum, p) => sum + p.points, 0);
  const reasons = parts.map((p) => p.note).filter(Boolean);

  // V6 Addition: Add points for same university & education tags
  const matchedBy: string[] = [];
  
  const selfUni = self.match_attributes?.['university'] || [];
  const partUni = partner.match_attributes?.['university'] || [];
  const hasSharedUni = selfUni.length > 0 && partUni.length > 0 && selfUni.some(u => partUni.includes(u));
  if (hasSharedUni) {
    rawScore += 100;
    reasons.push(`Same University: ${selfUni.join(', ')} (+100)`);
    matchedBy.push('🎓 Same University');
  }

  const selfTags = self.match_attributes?.['education_tags'] || [];
  const partTags = partner.match_attributes?.['education_tags'] || [];
  const sharedTags = selfTags.filter(t => partTags.includes(t));
  if (sharedTags.length > 0) {
    const pts = Math.min(sharedTags.length * 30, 90);
    rawScore += pts;
    reasons.push(`Shared Campus Tags: ${sharedTags.join(', ')} (+${pts})`);
    matchedBy.push('🏫 Shared Campus Tags');
  }

  // Record other match explanation labels
  const matchedByDetails: Record<string, any> = {};

  if (hasSharedUni) {
    const sharedUni = selfUni.filter(u => partUni.includes(u));
    if (sharedUni.length > 0) {
      matchedByDetails.university = sharedUni[0];
    }
  }

  if (self.city && partner.city && self.city === partner.city) {
    matchedBy.push('📍 Same City');
    matchedByDetails.city = self.city;
  } else if (self.state && partner.state && self.state === partner.state) {
    matchedBy.push('📍 Same State');
    matchedByDetails.state = self.state;
  } else if (self.country && partner.country && self.country === partner.country) {
    matchedBy.push('🌎 Same Country');
    matchedByDetails.country = self.country;
  }

  if (self.interest_tags && partner.interest_tags) {
    const sharedInts = self.interest_tags.filter(t => partner.interest_tags!.includes(t));
    if (sharedInts.length > 0) {
      matchedBy.push('💻 Shared Interests');
      matchedByDetails.interests = sharedInts;
    }
  }

  if (self.languages && partner.languages) {
    const sharedLangs = self.languages.filter(t => partner.languages!.includes(t));
    if (sharedLangs.length > 0) {
      matchedBy.push('🗣 Same Language');
      matchedByDetails.languages = sharedLangs;
    }
  }

  if (recentPartners.has(partner.id)) {
    rawScore -= MATCH_WEIGHTS.recentPartnerPenalty;
    reasons.push(`Matched Recently (-${MATCH_WEIGHTS.recentPartnerPenalty})`);
  }

  const weightedScore = rawScore;
  const passesThreshold = phase === 'random' ? true : weightedScore >= threshold;

  // Determine structured match reason
  const isStrictMatch = self.match_mode === 'STRICT' || partner.match_mode === 'STRICT';
  const confidence = rawScore > 0 ? Math.min(Math.round((rawScore / 200) * 100), 100) : 41;
  const reasonMetadata: any = {
    reason: isStrictMatch ? 'strict_filters' : (matchedBy.length > 0 ? 'prefer_filters' : 'random'),
    confidence,
    matchedBy: matchedBy.length > 0 ? matchedBy : ['🎲 Random Match'],
    matchedByDetails
  };

  return {
    rawScore,
    weightedScore,
    reason: reasons.join(', ') || 'No preference overlap',
    threshold,
    phase,
    rank: 0,
    passesThreshold,
    reasonMetadata
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
