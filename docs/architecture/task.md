## PHASE 2: COMPLETE LIFECYCLE STATE MACHINE CERTIFICATION
- [x] Identify and map every single valid state on the frontend (e.g., `QUEUEING`, `MATCH_FOUND`, `NEGOTIATING`).
- [x] Identify and map every single valid state on the backend (e.g., `RESERVED`, `MATCHED`, `CONNECTED`).
- [x] Identify and document every state mismatch or transition failure where the frontend thinks it is in one state but the backend thinks it is in another.
- [x] Create a `Phase_2_Lifecycle_State_Machine.md` artifact with the results.

## PHASE 3: DATABASE SCHEMA & INVARIANTS AUDIT
- [x] Read the complete Supabase SQL schema (`schema.sql` or similar).
- [x] Certify every Foreign Key constraint.
- [x] Certify every Index, particularly on `visitor_sessions` and `matches`.
- [x] Review Realtime RLS policies to ensure clients cannot intercept other sessions.
## PHASE 4: WEBRTC & SIGNALING CERTIFICATION
- [x] Inspect frontend WebRTC signaling logic (`frontend/src/services/realtime.ts`, `frontend/src/webrtc/` or `useVideoChat.ts`).
- [x] Map the exact signaling payload structure (offer, answer, ICE candidates, skip).
- [x] Verify signaling timeout and failure handling.
- [x] Document the WebRTC signaling flow and any flaws in `Phase_4_WebRTC_Signaling.md`.

## PHASE 5: SPLIT-BRAIN ARCHITECTURE RESOLUTION
- [x] Compare Matchmaking logic in `api/_lib/matchmaking` (Vercel) and `backend/src/matchmaking` (Express).
- [x] Map routing overlaps (`/api/match/join` vs Express routes).
- [x] Document the authoritative engine and deployment configuration flaw in `Phase_5_Split_Brain.md`.

## PHASE 6: SERVER-SIDE REALTIME ARCHITECTURE
- [x] Inspect `backend/src/services/broadcast.ts` for Realtime usage.
- [x] Determine if WebSocket broadcasts from Cloudflare Workers are reliable.
- [x] Document the Server-Side Realtime architecture in `Phase_6_Server_Realtime.md`.

## PHASE 7: PRODUCTION RUNTIME VALIDATION & FAILURE REPRODUCTION
- [x] Reproduce CF-001 (Cascading Analytics Deletion / Foreign Keys)
- [x] Reproduce CF-002 (Realtime Broadcast Authorization)
- [x] Reproduce CF-003 (Unauthenticated Signaling Injection)
- [x] Reproduce CF-004 (Serverless Cron Execution Limit)
- [x] Reproduce CF-005 (WebSocket Anti-Pattern in Stateless Environment)
- [x] Generate Production Implementation Blueprint

---

# IMPLEMENTATION PHASE

## MILESTONE 1: AUTHENTICATION MIGRATION
- [x] Implement Supabase Anonymous Auth (`signInAnonymously`).
- [x] Migrate `visitor_sessions` to map to `auth.users` via trigger or ID alignment.
- [x] Update frontend context (`SessionContext`) to use `auth.uid()`.
- [x] Verify functionality (Desktop, Mobile, Refresh, Reconnect, Incognito). *(Completed)*
- [x] Certification: Pass all Phase 7 regression scripts.

## MILESTONE 2: DATABASE MIGRATION (ATOMIC)
- [x] Implement `deleted_at` on `visitor_sessions` (Soft Deletion).
- [x] Fix `reports` and `matches` constraints based on ADR-004.
- [x] Implement Realtime Authorization policies on `realtime.messages`.
- [x] Commit transaction.

## MILESTONE 3: MATCHMAKING RPC
- [ ] Write `execute_matchmaking` PL/pgSQL function.
- [ ] Ensure idempotency, atomic locks, starvation prevention.
- [ ] Migrate Cloudflare Worker to trigger RPC on `/join` and `/ping`.

## MILESTONE 4: REALTIME SECURITY
- [ ] Certify Realtime RLS policies via adversarial scripts.
- [ ] Prevent unauthorized subscribe/broadcast.

## MILESTONE 5: FRONTEND MIGRATION
- [ ] Update `realtime.ts` to use `postgres_changes` on `matches`.
- [ ] Synchronize `matches` state with `webrtc` signaling state.

## MILESTONE 6: DIGITAL TWIN SIMULATION
- [ ] Run 1000s of headless cycles.
- [ ] Final production certification.
