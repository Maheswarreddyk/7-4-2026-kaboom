import { calculateCompatibility, SessionProfile } from '../src/matchmaking/scoringEngine.js';
import { MATCH_WEIGHTS } from '../src/matchmaking/config.js';

describe('Scoring Engine', () => {
  const baseProfile = (id: string, mode: 'RANDOM' | 'PREFER' | 'STRICT' = 'RANDOM'): SessionProfile => ({
    id,
    match_mode: mode,
    status: 'SEARCHING',
    gender: 'boy',
    looking_for: ['girl'],
    interest_tags: [],
    languages: [],
    match_attributes: {},
    match_constraints: {},
  });

  const recentPartners = new Set<string>();
  const reportedIds = new Set<string>();

  beforeEach(() => {
    recentPartners.clear();
    reportedIds.clear();
  });

  describe('Random Mode', () => {
    it('should match two users instantly if gender matches', () => {
      const userA = baseProfile('A', 'RANDOM');
      const userB = { ...baseProfile('B', 'RANDOM'), gender: 'girl', looking_for: ['boy'] };

      const result = calculateCompatibility(userA, userB, 0, recentPartners, reportedIds);
      expect(result).not.toBeNull();
      expect(result?.passesThreshold).toBe(true);
      expect(result?.reasonMetadata?.reason).toBe('random');
    });

    it('should NOT match if gender preference is incompatible', () => {
      const userA = baseProfile('A', 'RANDOM');
      // User B is a boy looking for a boy, User A is a boy looking for a girl
      const userB = { ...baseProfile('B', 'RANDOM'), gender: 'boy', looking_for: ['boy'] };

      const result = calculateCompatibility(userA, userB, 0, recentPartners, reportedIds);
      expect(result).toBeNull();
    });
  });

  describe('Strict Mode', () => {
    it('should match when strict attributes and interest tags align perfectly', () => {
      const userA = { ...baseProfile('A', 'STRICT'), interest_tags: ['coding', 'music'] };
      const userB = { ...baseProfile('B', 'STRICT'), interest_tags: ['coding', 'music'], gender: 'girl', looking_for: ['boy'] };

      const result = calculateCompatibility(userA, userB, 0, recentPartners, reportedIds);
      expect(result).not.toBeNull();
      expect(result?.passesThreshold).toBe(true);
      expect(result?.reasonMetadata?.reason).toBe('strict_filters');
    });

    it('should NOT match when one user is missing a required strict tag', () => {
      const userA = { ...baseProfile('A', 'STRICT'), interest_tags: ['coding', 'music'] };
      const userB = { ...baseProfile('B', 'STRICT'), interest_tags: ['coding'], gender: 'girl', looking_for: ['boy'] }; // Missing 'music'

      const result = calculateCompatibility(userA, userB, 0, recentPartners, reportedIds);
      expect(result).toBeNull();
    });
  });

  describe('Prefer Mode', () => {
    it('should match and grant points based on shared interests', () => {
      const userA = { ...baseProfile('A', 'PREFER'), interest_tags: ['coding', 'art'] };
      const userB = { ...baseProfile('B', 'PREFER'), interest_tags: ['coding', 'music'], gender: 'girl', looking_for: ['boy'] };

      const result = calculateCompatibility(userA, userB, 0, recentPartners, reportedIds, undefined, 0);
      expect(result).not.toBeNull();
      // Should have 1 shared tag 'coding'
      expect(result?.reasonMetadata?.matchedBy).toContain('💻 Shared Interests');
    });
  });
  
  describe('Penalties and Blocks', () => {
    it('should block reported users completely', () => {
      const userA = baseProfile('A', 'RANDOM');
      const userB = { ...baseProfile('B', 'RANDOM'), gender: 'girl', looking_for: ['boy'] };
      reportedIds.add('B');

      const result = calculateCompatibility(userA, userB, 0, recentPartners, reportedIds);
      expect(result).toBeNull();
    });

    it('should apply penalty for recent partners in random mode', () => {
      const userA = baseProfile('A', 'RANDOM');
      const userB = { ...baseProfile('B', 'RANDOM'), gender: 'girl', looking_for: ['boy'] };
      recentPartners.add('B');

      const result = calculateCompatibility(userA, userB, 0, recentPartners, reportedIds);
      expect(result).not.toBeNull();
      // Score should be reduced by the penalty
      expect(result?.rawScore).toBeLessThan(MATCH_WEIGHTS.mutualPreference * 1.5);
    });
  });
});
