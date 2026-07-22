# Future Evolution Guide

**Important rule:** Never build today's feature in a way that blocks tomorrow's architecture.

Think:
`Current -> 6 months -> 1 year -> 100,000 users -> 1 million users`

Every decision should remain understandable.

## Scaling the Architecture
- Currently, matchmaking is a synchronous PL/pgSQL function. At 1 million users, this may become a bottleneck, requiring a dedicated in-memory worker (e.g., Redis queues or a Go matchmaking service). Do not tightly couple the frontend to Postgres specifics.
- The `matched` Realtime event is currently a broadcast. Eventually, a dedicated WebSocket server may be needed for lower latency. Keep `realtime.ts` abstracted.

## Feature Evolution
- Smart Filters and AI matchmaking are on the roadmap. The `match_score` logic in the database should remain modular. Do not hardcode preference evaluation directly into the main `execute_matchmaking` loop.

If a requested implementation solves today's problem but increases tomorrow's complexity, redesign it before implementing it.
