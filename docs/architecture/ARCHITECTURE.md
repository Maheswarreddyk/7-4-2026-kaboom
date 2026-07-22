# Kaboom System Architecture

## Current State (Post-Milestone 6)

Kaboom is a real-time anonymous video matchmaking platform built on a serverless, edge-native architecture.

### 1. Edge Compute (Cloudflare Workers)
- **Role:** Stateless API gateway, authentication, and session management.
- **Tech:** Hono.js on Cloudflare Workers.
- **Responsibilities:**
  - Authenticating anonymous users.
  - Writing session states to the database.
  - Issuing secure Realtime tokens for Supabase.

### 2. Database & State (Supabase PostgreSQL)
- **Role:** Central source of truth and concurrency control.
- **Tech:** PostgreSQL (Supabase).
- **Responsibilities:**
  - Matching logic executed via PL/pgSQL RPCs (`execute_matchmaking`).
  - Row Level Security (RLS) policies protecting channels.
  - Cascading deletes and zero-zombie session management via Edge HTTP triggers.

### 3. Realtime Signaling (Supabase Realtime)
- **Role:** Low-latency WebRTC signaling and presence.
- **Tech:** Elixir/Phoenix (Supabase Realtime).
- **Responsibilities:**
  - Private, RLS-secured channels per match.
  - Direct peer-to-peer signaling payload exchange bypassing the Edge Worker.

### 4. Frontend (React / Vite)
- **Role:** User interface and WebRTC media handling.
- **Tech:** React, Vite, Supabase JS Client.

## Invariants
1. **Single Source of Truth:** The database owns all state. Workers are stateless routers.
2. **Event-Driven:** Matching is triggered by user actions (Join, Skip), not crons.
3. **Pessimistic Concurrency:** Database row locks (`FOR UPDATE SKIP LOCKED`) prevent duplicate matches.
