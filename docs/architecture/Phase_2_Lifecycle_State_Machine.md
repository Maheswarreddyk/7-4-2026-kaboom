# Phase 2: Complete Lifecycle State Machine Certification

This document represents the independent audit of the state machines governing the Kaboom matching lifecycle.

## 1. Frontend Lifecycle State Machine (`LifecycleManager.ts`)

The frontend relies on an `EventEmitter`-based state machine (`LifecycleManager.ts`). It emits events that React hooks (`useVideoChat`) listen to for rendering UI and managing WebRTC.

### Defined States:
1. `HOME`: Idle on the home screen.
2. `CONFIGURING`: User is modifying settings/filters. Queue is blocked.
3. `QUEUEING`: Waiting for a match.
4. `MATCH_FOUND`: Match assigned by backend, setting up signaling.
5. `NEGOTIATING`: WebRTC offer/answer exchange is actively occurring.
6. `AWAITING_MEDIA`: Signaling complete, waiting for local and remote video/audio tracks to flow.
7. `CONNECTED`: Both peers have active media; fully active chat.
8. `TEARDOWN`: Cleaning up connection to return to QUEUEING or HOME.
9. `ENDED`: End of session (logout or fatal error).

## 2. Backend Lifecycle State Machine (`visitor_sessions`)

The backend tracks session state in Postgres (`visitor_sessions` table), enforced by `VALID_TRANSITIONS` in `matchingEngine.ts`.

### Defined States:
1. `CREATED`: Session instantiated.
2. `READY`: Session authenticated and active, but not searching.
3. `SEARCHING`: User is in `waiting_queue`.
4. `RESERVED`: Matching Engine locked the user for a match evaluation.
5. `MATCHED`: Match is confirmed and written to DB.
6. `SIGNALING`: **(GHOST STATE)** Intended for active WebRTC negotiation.
7. `CONNECTED`: Media flow established.
8. `PARTNER_LEFT`: Peer disconnected.
9. `REQUEUEING`: User clicked 'Skip' (Next) or partner left, preparing to re-enter search.
10. `TERMINATED` / `ENDED`: Session destroyed.

## 3. Disconnects and Architectural Anomalies Discovered

### A. The `SIGNALING` Ghost State
The backend defines a `SIGNALING` state intended to map to the frontend's `NEGOTIATING` and `AWAITING_MEDIA` states. However, **`SIGNALING` is never entered by the backend code**. 
- When the frontend transitions to `NEGOTIATING` (via the `/match/ready` endpoint), the backend only sets `negotiation_started = true` on the `matches` table. The `visitor_sessions` state remains `MATCHED`.
- The session jumps directly from `MATCHED` to `CONNECTED` when media is confirmed (via `/match/connected`).

### B. The Heal Cycle Destroys `SIGNALING` (Root Cause of Ghost State)
If `SIGNALING` were actually used, it would break the application.
- In `matchingEngine.ts` (Line 290), the `runGlobalHealCycle` evaluates active queue entries.
- It explicitly protects `CONNECTED`, `MATCHED`, `SEARCHING`, and `RESERVED` states.
- It **does not protect `SIGNALING`**.
- If a user were in `SIGNALING`, the heal cycle would see an unknown state, assume a desync, and forcefully transition the user back to `SEARCHING`, tearing down the active WebRTC negotiation.

### C. State Desync Guardrail (`routes/index.ts`)
The V9 State Synchronization Guardrail in the `/session/heartbeat` endpoint checks if the frontend is `READY`/`SEARCHING` while the DB is `RESERVED`/`READY`/`CONNECTED` (with an active match). If this occurs, it tears down the match.
- **Flaw**: It does not check if the frontend is in `HOME`, `CONFIGURING`, or `TEARDOWN`. If a user gets stuck in these states while the backend thinks they are matched, the heartbeat will silently succeed, leaving a permanent ghost match on the backend.

## 4. Lifecycle Execution Trace (Happy Path)

1. **User Joins**: `READY` (BE) -> `/match/join` -> `SEARCHING` (BE) / `QUEUEING` (FE).
2. **Matchmaker Locks**: `RESERVED` (BE).
3. **Matchmaker Confirms**: `MATCHED` (BE) -> Broadcast `match_found` -> `MATCH_FOUND` (FE).
4. **Signaling Starts**: `/match/ready` -> `matches.negotiation_started = true` -> Broadcast `start_negotiation` -> `NEGOTIATING` (FE). **(Backend session stays `MATCHED`)**.
5. **Media Wait**: Signaling finishes -> `AWAITING_MEDIA` (FE).
6. **Media Flow**: `/match/connected` -> `CONNECTED` (BE) -> Broadcast `session_connected` -> `CONNECTED` (FE).

## Conclusion of Phase 2
The lifecycle state machines are functionally operational but contain a critical architectural drift (`SIGNALING` ghost state). The mapping is now perfectly documented, allowing us to proceed to Phase 3.
