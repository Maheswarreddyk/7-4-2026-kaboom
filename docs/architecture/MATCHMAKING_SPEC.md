# Matchmaking Specification: Adaptive Intelligence Engine

## 1. Product Philosophy & User Intent Model

The primary goal of the Kaboom matchmaking engine is to **maximize successful, high-quality connections while respecting user intent.** In an early-stage platform, liquidity (connection speed) is more critical than absolute perfection. Users will tolerate a less-than-perfect match if they understand *why* they were connected and if it happens quickly. They will abandon the platform if they are left staring at a loading screen.

### User Intent Categories:
1. **RANDOM (Speed-Optimized):** "Connect me immediately. Try to honor my preferences if possible, but do not make me wait."
2. **SMART (Balance-Optimized):** "Try hard to find exactly what I want, but if nobody is available, fall back to the next best thing so I'm not waiting forever."
3. **EXACT (Precision-Optimized):** "I only want this exact criteria. I am willing to wait indefinitely for it."

---

## 2. Candidate Ranking Model

Rather than returning the "first available" user, the engine will search the entire available queue and assign a **Match Score** to every candidate. The candidate with the highest score is selected.

### Scoring Factors:
- **Mutual Preference (+10,000 pts):** User A wants User B's gender, AND User B wants User A's gender.
- **One-Sided Preference (+5,000 pts):** User A wants User B's gender, but User B is looking for "Anyone".
- **Shared Tags (+100 pts per tag):** Up to 3 user-defined interest tags.
- **Shared Language (+50 pts):** Overlapping languages.
- **Shared Location (+50/25/10 pts):** City/State/Country alignment.
- **Queue Aging (+1 pt per second):** Prevents starvation by boosting users who have been waiting the longest.
- **Previously Skipped (-99,999 pts):** Prevents matching with someone the user just skipped in the current session.

---

## 3. Adaptive Search Strategy

The system evaluates the candidate pool dynamically instead of relying on rigid time-based cooldowns. Any queue event (Join, Skip, Disconnect) triggers an immediate recalculation.

### Priority Ladders

#### A. RANDOM Mode
*Goal: Sub-second connection.*
1. **Tier 1 (Perfect Mutual):** Highest ranked mutual preference candidate.
2. **Tier 2 (One-Sided):** Highest ranked one-sided candidate.
3. **Tier 3 (Fallback):** Highest ranked active user, regardless of preferences.

#### B. SMART Mode
*Goal: Preference-first, fluid relaxation.*
1. **Tier 1 (Mutual + Shared Tags):** Mutual preference with at least 1 overlapping tag.
2. **Tier 2 (Mutual):** Mutual preference, ignoring tags.
3. **Tier 3 (One-Sided + Tags):** One-sided preference with tag overlap.
4. **Tier 4 (One-Sided):** One-sided preference.
5. **Tier 5 (Fallback):** If queue is stagnant, fall back to any active user (only if user hasn't explicitly opted out of fallback).

#### C. EXACT Mode
*Goal: Strict compliance.*
1. **Tier 1 (Strict):** Must satisfy Mutual Preference, Tags, and Location precisely. Wait forever until condition is met.

---

## 4. Queue Architecture & State Machine

### Event-Driven Matching
- **No Artificial Delays:** When a user clicks "Skip", they are immediately returned to the queue and the ranking engine fires instantly.
- **Starvation Prevention:** Queue aging mathematically guarantees that long-waiting users eventually bubble to the top of the candidate pool.
- **Ghost Cleanup:** Disconnections trigger an immediate database cleanup, dropping the user from the queue. If a user was matched with a ghost, the ghosting triggers an immediate re-queue for the survivor without penalty.

---

## 5. UX Flows & Transparency

### The Queue Interface (Pre-Match)
Instead of a full-screen "Searching..." loader, the UI will adopt a utility-first waiting room:
- **Split Screen:** 
  - **Left 50%:** Live camera preview (mirror). Allows the user to adjust lighting, hair, and microphone before the connection drops in.
  - **Right 50%:** Search progress and queue intelligence.
- **Controls:** Mute, Stop Video, Flip Camera, Settings are accessible. Match actions (Gift, Like, Skip) are disabled until connected.

### Search Messaging (Live Intelligence)
The right panel will dynamically narrate the adaptive search process:
- *"Looking for someone who matches your preferences..."*
- *"No exact matches online. Checking users with similar interests..."*
- *"Expanding the search to connect you faster..."*

### UX Suggestions
If the queue is heavily skewed (e.g., 95% Male, 5% Female):
- *"No Female users are currently online. Try switching to SMART Match to connect with active users faster."*

### Match Explanation (Transparency)
Immediately upon a successful WebRTC connection, a transient UI overlay will explain *why* the connection occurred:
- ⭐ **Excellent Match**: *"Matched because: ✓ Mutual Preference ✓ 2 common interests ✓ English"*
- 👍 **Good Match**: *"Matched because: ✓ One-sided preference ✓ Nearby location"*
- 🎲 **Random Match**: *"Matched because: No exact match was available, so we connected you with another active user."*

---

## 6. Database & API Changes

### Database (PostgreSQL)
- **`visitor_sessions`**: Add `match_mode` (VARCHAR), `tags` (TEXT[] limit 3), `skip_history` (UUID[]).
- **`calculate_match_score(user_a, user_b, mode)`**: Rewrite to implement the point-based ranking engine.
- **`execute_matchmaking(session_id)`**: Rewrite to use `ORDER BY score DESC LIMIT 1`.

### Backend API (Cloudflare Worker)
- **`/api/matchmaking/join`**: Accept detailed payloads containing Mode, Tags, and strict preferences.

### Realtime (Supabase)
- **`matched` Event**: Append `match_reason` and `match_confidence` payloads so the frontend can render the transparent explanation overlay.

---

## 7. Future Extensibility

The scoring and ranking engine allows for seamless future expansion:
- **Safety Scoring:** Subtract 5,000 points from candidates with high report ratios.
- **AI Semantic Matching:** Embed user bios and interests to generate a semantic proximity score (+1 to +1000) added to the base rank.
- **Premium Filters:** Add `is_premium` checks to restrict Tier 1 access to paid users.
- **Reputation System:** Boost queue priority for users who consistently receive positive "Good Interaction" feedback.

---

## User Review Required

> [!IMPORTANT]  
> This specification represents a fundamental shift from a "first-available time-based" loop to a **Rank-Based Adaptive Intelligence Engine**. 
> 
> Please review the logic above, particularly the **Priority Ladders** and the **UX Flows**. 
> 
> If you approve of this design, click **Proceed**, and I will begin the Zero-Regression Implementation Protocol, starting with the database schema updates and the PL/pgSQL ranking engine!
