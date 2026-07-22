# Phase 3: Database Schema & Invariants Audit

As part of the Kaboom Production Certification, an independent architectural audit of the Supabase PostgreSQL database schema was performed. 

## Scope of Audit
1. `kaboom_final_schema.sql` & `kaboom_production_schema_v2.sql`
2. Foreign Key constraints and cascading behavior.
3. Indexing strategy for matchmaker performance.
4. Supabase Realtime Authorization and RLS (Row Level Security) policies.

---

## 1. Foreign Key Constraints (CRITICAL FINDINGS)

The database heavily relies on `ON DELETE CASCADE` from `visitor_sessions` and `matches`.

> [!WARNING]
> **Data Loss Risk in Analytics & Moderation**
> The tables `reports` and `feedback` are defined with:
> `reporter_session UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE`
> `reported_session UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE`
> `feedback.session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE`
> 
> **Impact:** If `visitor_sessions` rows are ever hard-deleted (e.g., by a routine 30-day database cleanup cron), **all abuse reports and feedback ratings associated with those users will be instantly destroyed**. 
> **Architectural Decision Required:** 
> - Either strictly forbid hard-deleting `visitor_sessions` (they are currently just marked `status = 'TERMINATED'`).
> - OR alter the schema to use `ON DELETE SET NULL` for analytics and moderation tables (which requires dropping the `NOT NULL` constraint).

---

## 2. Indexing Strategy (PASSED)

The index design is generally robust and supports the matchmaker engine.

- `visitor_sessions`: Indexed on `session_token`, `status`, `created_at`, and `match_id`.
- `waiting_queue`: Contains a brilliant invariant index:
  `CREATE UNIQUE INDEX idx_waiting_queue_active_session ON waiting_queue(session_id) WHERE status = 'waiting';`
  This guarantees a session can mathematically only occupy one spot in the queue at a time.
- `matches`: Indexed on `user_a`, `user_b`, and `started_at`.
- `reservations`: Well indexed on `match_id`, `session_id`, `initiator_session_id`, and `partner_session_id`.

**Verdict:** Indexing is production-ready. 

---

## 3. Realtime RLS Policies (SEVERE ARCHITECTURAL FLAW)

The platform relies on Supabase Realtime Broadcasts for WebRTC signaling (`match:{matchId}`).

> [!CAUTION]
> **Total Absence of Realtime Authorization**
> The frontend uses the public `anon` key to connect to Supabase Realtime. The backend does not issue custom JWTs, and the schema contains **zero** Realtime RLS policies (`realtime.messages`).
> 
> **Impact:** Because there is no authorization, Supabase allows *anyone* with the anon key to subscribe to any broadcast channel. The system relies entirely on **Security by Obscurity** (the fact that `matchId` is a UUIDv4 and hard to guess). 
> If a `matchId` is ever leaked (via screenshot, logs, or a malicious browser extension):
> 1. An attacker can silently join the `match:{matchId}` channel.
> 2. The attacker will receive all WebRTC signaling payloads, exposing the private IP addresses of both users via ICE candidates.
> 3. The attacker can forge and inject `offer` or `skip_pending` payloads to instantly DOS the match.

### Recommended Fix for Realtime
Since users are anonymous (no Supabase Auth), the backend *must* issue custom signed JWTs containing the `sessionId` and `matchId` when the match is created. The Supabase Realtime RLS policy must then enforce that `auth.jwt() ->> 'matchId' = matchId` before allowing connection to the broadcast channel.

---

## Conclusion
The database schema is functionally sound for matchmaking, but poses significant risks for long-term moderation (due to Cascading deletes) and signaling security (due to missing Realtime auth).

**Approval Required:** Do you want to implement the fixes for the Cascading Deletes and Realtime Auth now, or document them as known limitations and proceed to Phase 4 (WebRTC / Socket Certification)?
