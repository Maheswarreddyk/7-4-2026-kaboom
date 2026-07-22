# Known Limitations & Constraints

1. **Cloudflare Worker Limits:**
   - 10ms CPU time limit on free tier, 50ms on paid. Matchmaking triggers (`/join`) must offload all heavy lifting to the Supabase Database layer via RPC to avoid CPU exhaustion on Edge.
   - Workers cannot maintain persistent WebSockets for prolonged periods, necessitating the use of Supabase Realtime for the signaling layer.

2. **WebRTC Complexities:**
   - Strict NAT types (Symmetric NAT) will occasionally fail peer-to-peer connection. We currently rely on Google's STUN servers. A production TURN server (e.g., Twilio Network Traversal or Metered TURN) is required for 100% connection reliability.

3. **Supabase Realtime Broadcast Limits:**
   - Broadcast channels are highly performant but have a payload limit. Signaling payloads (SDP/ICE) must remain small.

4. **Matching Scalability:**
   - The current `execute_matchmaking` PL/pgSQL function performs a sequence scan on `waiting_queue`. For 1,000,000 concurrent users, this query must be indexed heavily (e.g., BRIN indices on `joined_at` or partitioned by `match_mode`). Currently optimized for < 10,000 concurrent searchers.
