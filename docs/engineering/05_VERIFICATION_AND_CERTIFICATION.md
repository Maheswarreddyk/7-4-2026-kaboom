# Verification and Certification

This file explains: **How do we know something actually works?**
Code is not considered working until it is certified with observed evidence.

## Database Evidence
- **Expected:** RPC returns JSONB with `match_id`.
- **Actual:** DB console output showing `{ success: true, match_id: 'uuid' }`.

## API Evidence
- **Expected:** API parses DB response and returns `200 OK`.
- **Actual:** Network tab or worker log showing exact JSON output.

## Frontend Evidence
- **Expected:** UI transitions from "Searching" to "Connected".
- **Actual:** Screenshot or DOM log of the state change.

## Realtime Evidence
- **Expected:** Backend broadcasts `matched` event payload.
- **Actual:** Client websocket trace showing the incoming payload exactly matching the TypeScript interface.

## WebRTC Evidence
- **Flow:** Offer -> Answer -> ICE -> Connected.
- **Actual:** `RTCPeerConnection` signaling state logging `stable`, ICE connection state logging `connected`.

Everything must have evidence. Assumptions are not evidence.
