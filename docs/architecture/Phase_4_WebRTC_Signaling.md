# Phase 4: WebRTC & Signaling Certification

As part of the Kaboom Production Certification, an independent architectural audit of the WebRTC signaling logic was performed on the frontend (`useVideoChat.ts`, `realtime.ts`, and `webrtc/index.ts`).

## 1. Signaling Payload Structure

The WebRTC signaling occurs over the Supabase Realtime Broadcast channel `match:{matchId}`. 
The expected payloads exchanged are:

| Event | Direction | Payload Structure |
|-------|-----------|-------------------|
| `offer` | Caller → Callee | `{ fromSessionId: string, offer: RTCSessionDescriptionInit }` |
| `offer_ack` | Callee → Caller | `{ fromSessionId: string }` |
| `answer` | Callee → Caller | `{ fromSessionId: string, answer: RTCSessionDescriptionInit }` |
| `answer_ack` | Caller → Callee | `{ fromSessionId: string }` |
| `ice_candidate`| Both | `{ fromSessionId: string, candidate: RTCIceCandidateInit }` |
| `skip_pending` | Initiator | `{}` |
| `skip_cancelled`| Initiator | `{}` |
| `abortMatch` | Both | `{ matchId: string }` |
| `reconnect` | Both | `{}` |

> [!NOTE]
> The backend determines the caller via the `isInitiator` boolean flag sent during the `matched` event. The caller creates the `RTCPeerConnection` and fires the `offer`.

---

## 2. Timeout and Failure Handling (PASSED)

The signaling engine employs rigorous resilience mechanisms to prevent stranded sessions:

1. **Offer Retry Timer**: If an `offer` is sent but no `offer_ack` is received within 5 seconds, the caller retries. If 2 attempts fail (10 seconds total), the caller strictly aborts the negotiation and re-enters the queue.
2. **Global WebRTC Timeout**: A hard 15-second timer (`webrtcTimeoutRef`) starts when signaling begins. If the media connection state does not reach `CONNECTED` (or `ENDED`) by 15 seconds, the match is unilaterally torn down.
3. **Perfect Negotiation (Glare Handling)**: `webrtc/index.ts` implements explicit rollback (`setLocalDescription({ type: 'rollback' })`) if an offer is received while the peer is already in a `have-local-offer` state.

---

## 3. Security Vulnerabilities (CRITICAL FINDINGS)

> [!CAUTION]
> **Unauthenticated Signaling Injection (CF-003)**
> Because Supabase Realtime Broadcast channels lack RLS (as discovered in Phase 3), the signaling layer is mathematically exposed to injection attacks. 
> 
> A malicious actor with knowledge of a `matchId` can inject forged payloads to the channel. Since `useVideoChat.ts` and `realtime.ts` do not strictly cryptographically verify the sender of these payloads (they just trust the `fromSessionId` string), an attacker can:
> - Send a fake `abortMatch` to instantly tear down any match.
> - Inject malicious `ice_candidate` payloads.
> - Send a fake `answer` before the real partner does, causing signaling state corruption.

### Proposed Architectural Solution (Deferred)
When the backend sends the `matched` event, it should also generate a **one-time cryptographically signed signaling token** (e.g., HMAC-SHA256 of the `matchId` and a server secret). All WebRTC payloads sent over the broadcast channel must include this signature, and `realtime.ts` must verify the signature before processing the payload.

---

## Conclusion
The WebRTC state machine, error handling, and timeout recovery are well-designed and production-ready. However, it relies entirely on the secrecy of the `matchId` UUID to guarantee signaling integrity. 

**Recommendation:** Proceed to Phase 5. The signaling injection vulnerability (CF-003) should be deferred and addressed alongside CF-002 (Realtime Broadcast Authorization) in a dedicated security hardening sprint.
