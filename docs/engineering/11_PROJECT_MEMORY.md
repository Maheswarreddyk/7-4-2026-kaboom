# Project Memory

This is Kaboom's institutional memory. Every completed milestone appends its history here.
When starting a new task, read why the code exists, what has already been tried, what failed, and what constraints shaped the current architecture.

---

## Milestone 7: Adaptive Matchmaking Engine
- **Objective:** Maximize successful connections while respecting user preferences (Tiered matching logic).
- **Architecture:** Transitioned from a raw queuing model to PL/pgSQL stored procedures (`execute_matchmaking`) running inside Supabase.
- **Problems Found:** Strict filters led to low liquidity.
- **Root Causes:** Users were leaving because they felt "nobody is online".
- **Lessons:** Liquidity is more valuable than perfect matching in early stages. Random shouldn't be stupid; it should be adaptive.
- **Trade-offs:** Server-side matching adds DB load but removes frontend race conditions.
- **Future Risks:** PL/pgSQL scaling at 1M+ users.

## Milestone 8: Production Verification (Incident Resolution)
- **Objective:** Certify that the core matchmaking flow actually works end-to-end on real devices.
- **Architecture:** Realtime broadcasts, WebRTC signaling.
- **Problems Found:** Users stuck searching indefinitely. Match rows never created.
- **Root Causes:** 
  1. `match_mode_type` ENUM in production lacked `SMART` and `EXACT` values, crashing the RPC.
  2. The RPC return type changed to JSONB (`{success, match_id}`), but the backend API still tried to parse it as a flat UUID.
- **Lessons:** Contract consistency is critical. An RPC signature change must trigger a full system audit.
- **Future Opportunities:** Fully automated Digital Twin simulator that runs continuously.

## Milestone 9: Authentication & Environment Parity (Zero Assumption Audit)
- **Objective:** Finalize production certification and resolve architectural schema drift.
- **Architecture:** Transitioned strictly to Supabase Anonymous Auth for the Realtime identity layer. Dropped legacy custom JWT issuance to eliminate conflict with Supabase's native auth model.
- **Problems Found:** Production database schema drifted from SQL migrations (`match_mode_type` ENUM and `matches.status` column missing in `100_fresh_schema.sql`). Duplicate Realtime RLS policies caused evaluation overhead. Backend environment variables used `process.env` instead of Cloudflare's `env` bindings via Hono.
- **Root Causes:** 
  1. Quick fixes applied directly to the production database via Supabase UI weren't backported to the repository.
  2. Legacy JWT mechanisms were partially ripped out but left artifacts in RLS policies.
- **Lessons:** The SQL migration scripts in the repository MUST be the absolute source of truth. If a fix is made in production, it must immediately be reflected in the `.sql` files.
- **Fixes Applied:** 
  - Bound `visitor_sessions.id` directly to `auth.uid()` from the Anonymous JWT to seamlessly integrate with native Realtime RLS.
  - Refactored `config/index.ts` to strictly use Hono `getEnv()`.
  - Synced schema drift (`100_fresh_schema.sql`).
  - Purged duplicate `"Authorize Match Channel"` policy.
