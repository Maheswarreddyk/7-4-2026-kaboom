# Architecture Overview

**Purpose:** This file explains the entire platform. Every engineer and agent must understand this flow before writing code.

## The Kaboom Pipeline

```
User (Browser)
    ↓
React Frontend (Vite, TS, Tailwind)
    ↓
Cloudflare Worker (Hono, Backend Services)
    ↓
Match Engine (Supabase RPCs, PL/pgSQL)
    ↓
Database (Supabase PostgreSQL)
    ↓
Realtime (Supabase Realtime API)
    ↓
WebRTC Signaling (Frontend to Frontend via Realtime)
    ↓
Media (P2P Video/Audio)
    ↓
Cleanup & Analytics (Background Tasks / Metrics)
    ↓
Dashboard (Simulator / Digital Twin)
```

## Component Breakdown

1. **Frontend (`/frontend`)**
   - **Purpose:** Provide the UI, handle media devices, manage the WebRTC connection lifecycle.
   - **Dependencies:** WebRTC API, Supabase JS Client, Backend API.
   - **Failure modes:** Camera denial, WebRTC ICE failures, lost Realtime subscriptions.

2. **Backend (`/backend`)**
   - **Purpose:** Serve as a secure middleware and orchestration layer via Cloudflare Workers.
   - **Dependencies:** Hono, Supabase REST APIs.
   - **Failure modes:** Cold start latency, KV/DB connection timeouts, parsing errors.

3. **Database & Match Engine (`/supabase`)**
   - **Purpose:** Atomic truth, queue reservations, and the adaptive matchmaking algorithm.
   - **Dependencies:** PostgreSQL, PL/pgSQL.
   - **Failure modes:** Enum drifts, transaction deadlocks, race conditions in reservations.

4. **Realtime**
   - **Purpose:** Instant messaging between users (Signaling & Chat).
   - **Dependencies:** Supabase Realtime service.
   - **Failure modes:** Dropped packets, unhandled disconnections.

5. **Simulator (`/simulator`)**
   - **Purpose:** Digital Twin to prove platform behavior without human intervention.
   - **Dependencies:** Puppeteer, Backend API.
   - **Failure modes:** DOM changes breaking selectors, headless network issues.
