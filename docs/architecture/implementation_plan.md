# Milestone 7: Advanced Matchmaking Engine (Random, Smart, Exact)

Currently, the matchmaking engine in the database uses a "Time-based Relaxation" strategy for *everyone*. It starts strict, and every 15-30 seconds it drops requirements (interests, then language, then location) until it eventually matches you with anyone. It also currently has a flaw where gender preferences are treated as "OR" instead of "AND" (meaning if you want a Female, but a Male wants "anyone", it might still connect you).

We need to make this explicit, powerful, and strictly enforce the user's choice.

## The Matchmaking Filter Roadmap

We will split the system into three distinct modes that the user can choose from before joining:

### 1. `EXACT` Mode (The Purist)
- **Behavior:** The engine will **never** relax your constraints. 
- **Rules:** 
  - Mutual gender consent is mathematically required (`User A wants User B's gender` AND `User B wants User A's gender`).
  - Strict filtering: If you filter by Country, Language, or Interest, the engine will strictly require them.
  - Time decay is ignored. If it takes 10 minutes to find the exact match, the user waits 10 minutes.

### 2. `SMART` Mode (The Default)
- **Behavior:** Balances preference with wait time (similar to current design but fixed).
- **Rules:**
  - Mutual gender consent is **always** strictly enforced. You will never see a gender you didn't ask for.
  - **0-15s:** Tries to find an EXACT match (Location, Languages, Interests).
  - **15-30s:** Drops Interest requirements.
  - **30-60s:** Drops Language requirements.
  - **60-120s:** Drops Location requirements.
  - **>120s:** Matches you with anyone (but still strictly enforces gender).

### 3. `RANDOM` Mode (The Wildcard)
- **Behavior:** Instant connection.
- **Rules:**
  - Bypasses all scoring logic.
  - Immediately connects with the first available person who is also searching for Random or Anyone.
  - Sub-10 millisecond match times.

---

## Proposed Changes

### Database Layer (PL/pgSQL)

#### [MODIFY] `supabase/migrations/milestone5_advanced_matchmaking.sql`
- Create a new migration file to completely rewrite `calculate_match_score` and `execute_matchmaking`.
- Fix the `v_self_wants AND v_partner_wants` logic so gender boundaries are impenetrable.
- Introduce `match_mode` branching (`IF v_self.match_mode = 'EXACT' THEN ...`).
- Apply the new `execute_matchmaking` directly to the live database using `apply_schema.js`.

### Backend (Cloudflare Worker)

#### [MODIFY] `backend/src/routes/matchmaking.ts`
- Ensure the `/join` API endpoint accepts `matchMode`, `lookingFor`, `languages`, `interestTags`, and `location`.
- Update the `visitor_sessions` record with these exact values *before* invoking `execute_matchmaking`.

### Frontend (React / Vite)

#### [MODIFY] `frontend/src/pages/Home.tsx` (or Pre-Match Modal)
- Implement the UI for the 3 modes: **Random | Smart | Exact**.
- Add multi-select dropdowns for **Gender Preference**, **Languages**, and **Interests**.
- Ensure these selections are saved locally so the user doesn't have to pick them every time.
- Pass the selected filter state into the WebSocket/HTTP `/join` payload.

---

## User Review Required

> [!IMPORTANT]  
> Please review the definitions for **EXACT**, **SMART**, and **RANDOM** modes above. 
> 
> Specifically: In `SMART` mode, after 120 seconds, it will drop location and language requirements to get you a match, but it will **never** drop your Gender preference. Is this exactly how you want it to behave? 
> 
> Click **Proceed** to approve this roadmap, and I will begin rewriting the Database Matchmaking Engine!
