# Recurring Pitfalls

Gravity MUST check this checklist BEFORE coding to prevent huge numbers of regressions.

## Database
- [ ] Enum mismatch (Did you update Postgres, TS Types, and Frontend Types?)
- [ ] Schema mismatch (Did you run migrations?)
- [ ] Generated types (Did you update `database.types.ts`?)
- [ ] Missing migration (Are changes tracked in SQL?)
- [ ] FK integrity (Do deleted rows cascade properly?)

## API
- [ ] DTO mismatch (Does the Frontend send what Backend expects?)
- [ ] JSON vs UUID (Did an RPC return type change?)
- [ ] Nullability (Can this value be NULL in the DB?)

## Realtime
- [ ] Broadcast payload (Does the payload match the TS interface exactly?)
- [ ] Channel (Are both users subscribing to the same `session:id`?)
- [ ] Subscription (Is the listener mounted before the broadcast happens?)

## WebRTC
- [ ] Offer (Is SDP valid?)
- [ ] Answer (Is SDP valid?)
- [ ] ICE (Are STUN/TURN servers provided?)
- [ ] Cleanup (Are peer connections closed and tracks stopped on unmount?)

## Cloudflare
- [ ] Deployment (Did you `wrangler deploy`?)
- [ ] Cached Worker (Is the old worker still serving requests?)
- [ ] Env Variables (Are secrets mapped correctly?)

## Supabase
- [ ] RPC (Is the PL/pgSQL function updated?)
- [ ] RLS (Are policies allowing access?)
- [ ] Realtime (Is the table replication enabled?)
- [ ] Storage (Are buckets public?)

## Simulator
- [ ] Same APIs (Does the simulator hit the same endpoints as real users?)
- [ ] Same contracts (Does the simulator parse Realtime events correctly?)
- [ ] Same schema (Is the simulator creating users that match the DB schema?)
