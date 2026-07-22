# System Invariants

These are the strict, undeniable rules of the Kaboom architecture. They **MUST NEVER BE BROKEN**. Every engineer and agent should verify these invariants before every release.

## 1. The Session Invariant
**Rule:** One Session -> Exactly One Active State.
- A user cannot belong to more than one active match.
- A user cannot have more than one active queue record.
- A user cannot have multiple simultaneous signaling channels open.

## 2. The Match Invariant
**Rule:** A match ALWAYS has exactly two valid, active participants.
- Matches with one participant must be immediately cleaned up.
- Match score metadata must accurately reflect why the users were paired.

## 3. The Matchmaking Reservation Invariant
**Rule:** Queue retrieval and match creation must be atomic.
- A queue candidate must be locked/reserved synchronously during the PL/pgSQL algorithm.
- No two threads/workers can ever select the same partner simultaneously.

## 4. The Cleanliness Invariant
**Rule:** Cleanup is absolute.
- When a user disconnects or ends a session, the system MUST remove:
  - Their queue entry
  - Their match reservations
  - Their temporary signaling/Realtime channels
  - Their backend memory state
- Orphaned data leads to ghost matches. Ghost matches destroy the platform.

## 5. The Telemetry Invariant
**Rule:** Every completed matchmaking decision must leave an audit trail.
- Why was A matched with B?
- How many candidates were evaluated?
- What was the search latency?
- This telemetry is non-negotiable for system certification.
