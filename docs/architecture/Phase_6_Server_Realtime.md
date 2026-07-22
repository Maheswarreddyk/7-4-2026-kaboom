# Phase 6: Server-Side Realtime Architecture Certification

As part of the Kaboom Production Certification, an independent architectural audit of the server-side broadcasting mechanism was conducted to evaluate the "Server-Side Realtime Anti-Pattern" problem.

## 1. Analysis of `broadcast.ts` (CRITICAL FINDING CF-005)

The server relies on `backend/src/services/broadcast.ts` to push state changes (e.g., `matched`, `partner_left`) to frontend clients over Supabase Realtime. 

### The Flawed Implementation
```typescript
const channel = supabase.channel(channelName);
try {
  // Send without subscribing (server doesn't need to receive)
  const resp = await channel.send({ type: 'broadcast', event, payload });
  ...
} finally {
  supabase.removeChannel(channel);
}
```

### Why This Fails Silently
The implementation makes a fundamentally incorrect assumption about how the Supabase Realtime (Phoenix) WebSocket protocol works.
1. **Unsubscribed Channels Cannot Broadcast:** The `supabase.channel().send()` method only works if the client has actively joined the channel via `.subscribe()`. Sending a message to an unsubscribed channel via the JS client does not automatically open a WebSocket connection, join the channel, and dispatch the message. It either fails silently or throws an error, depending on the client version.
2. **WebSocket Ephemerality in Cloudflare Workers:** Even if `.subscribe()` were called, Cloudflare Workers are entirely stateless and ephemeral. The worker receives an HTTP request, executes, and terminates. It cannot reliably hold open a WebSocket connection just to send a single broadcast message.
3. **Channel Churn:** Creating and immediately removing (`removeChannel`) a channel for every single broadcast generates massive WebSocket connection churn against the Supabase Realtime cluster.

### Symptoms in Production
Because the backend fails to broadcast the `matched` event reliably, users sit in the "SEARCHING" state indefinitely on the frontend, even though the database `matches` table shows they are paired.

### Proposed Architectural Solution (Deferred)
Instead of using the WebSocket-bound `supabase.channel().send()`, the backend must use the **Supabase Realtime REST API**. Supabase provides a direct HTTP POST endpoint for server-side broadcasts (`/realtime/v1/api/broadcast`). 
This is the only correct way to dispatch Realtime messages from stateless environments like Cloudflare Workers.

---

## Conclusion
The backend broadcasting mechanism is fundamentally broken due to a misunderstanding of WebSocket mechanics in stateless serverless environments. This explains the disconnect between database state and frontend UI state.

**Recommendation:** Proceed to Phase 7. The broadcasting mechanism (CF-005) should be deferred and addressed alongside the other matchmaking fixes.
