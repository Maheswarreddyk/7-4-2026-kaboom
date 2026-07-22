# Phase 5: Split-Brain Architecture Resolution

As part of the Kaboom Production Certification, an independent architectural audit of the backend matchmaking architecture was conducted to evaluate the "Split-Brain" problem identified in the Phase 1 Digital Twin analysis.

## 1. Split-Brain Resolution (PASSED)

The previous architecture suffered from two independent codebases attempting to run matchmaking: Vercel serverless functions (`api/_lib/matchmaking`) and an Express.js backend (`backend/src/matchmaking`).

**Discovery:** 
This issue has been successfully resolved in a previous refactoring phase. 
- The Vercel `api/` directory has been entirely deleted.
- The Express backend has been rewritten into a unified Cloudflare Worker using the Hono framework.
- There is now exactly **one authoritative matchmaking engine** residing in `backend/src/matchmaking`.

---

## 2. Matchmaking Scheduler Regression (CRITICAL FINDING CF-004)

> [!CAUTION]
> **Cloudflare Cron Frequency Limitation**
> While porting the backend from Render (Express) to Cloudflare Workers, the matchmaking scheduler (`MatchScheduler.ts`) which previously ran every 1.5 seconds (`setInterval`) was converted to a Cloudflare Worker Cron Trigger.

### The Problem
Cloudflare Worker crons have a **maximum execution frequency of 1 minute** (`* * * * *`). 
By inspecting `backend/wrangler.toml` and `backend/src/index.ts`, I verified that the `runGlobalMatchCycle()` function is now executed at most once every 60 seconds.

### Why This Breaks the Platform
1. **User Experience:** Users who join the queue will sit waiting for up to 60 seconds before the matchmaking engine even looks at them. A real-time chat platform requires sub-3-second matchmaking.
2. **Rule Relaxation Bypass:** The engine uses time-based relaxation (strict for 15s, relax interests at 30s, relax language at 60s, etc.). Because the tick rate is 60 seconds, users will almost immediately jump past the `strict` and `relaxInterests` phases before the engine evaluates them, completely bypassing the precision matching logic.

### Proposed Architectural Solution (Deferred)
Cloudflare Workers cannot run infinite background loops. To achieve high-frequency matchmaking (e.g., 2-second ticks), the architecture must either:
1. **Use Cloudflare Durable Objects** with Alarms to implement high-frequency background ticks.
2. **Move the Matchmaking Engine** to a persistent containerized service (e.g., Render Background Worker, AWS Fargate, or Fly.io) that runs a standard Node.js `setInterval`.
3. **Trigger Matchmaking on Queue Join**: Have the `joinQueue` API endpoint trigger an asynchronous matching cycle for the region, rather than relying solely on a cron.

---

## Conclusion
The Split-Brain issue is solved, but the resulting architecture introduces a fatal matchmaking latency flaw due to serverless cron limitations.

**Recommendation:** Proceed to Phase 6. The Matchmaking Scheduler (CF-004) should be deferred and addressed during the dedicated Matchmaking Logic Fixes phase (Phase 8).
