# Regression Checklist

For every architectural shift or milestone, the following invariants must be verified via the Digital Twin simulator and manual end-to-end tests:

## 1. Authentication & Integrity
- [ ] Users acquire Anonymous Sessions successfully.
- [ ] RLS policies strictly enforce read/write isolation per channel.
- [ ] WebRTC `onunload` beacon cleans up sessions reliably (0 zombie sessions).

## 2. Matchmaking Engine
- [ ] Queue lock mechanism (`FOR UPDATE SKIP LOCKED`) prevents duplicate reservations.
- [ ] Adaptive ranking successfully pairs users with overlapping preferences (Gender/Tags).
- [ ] Fallback algorithm functions if no perfect match exists (except in Exact mode).
- [ ] Queue aging boosts wait-time scores preventing starvation.

## 3. Realtime & WebRTC
- [ ] Supabase Realtime Channels establish securely.
- [ ] Signaling SDP/ICE candidates pass seamlessly between peers.
- [ ] Video/Audio streams establish under standard network conditions.

## 4. Error Handling
- [ ] Disconnections during the queue drop the user cleanly.
- [ ] Disconnections during a match gracefully end the match and optionally re-queue the survivor.
- [ ] "Skip" immediately triggers the matchmaking logic without artificial cooldowns.
