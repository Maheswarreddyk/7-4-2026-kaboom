# Architectural & Product Decision Log

## ADR-005: Adaptive Matchmaking Engine
**Date:** 2026-07-22
**Status:** Approved
**Context:** The previous matchmaking engine used a rigid time-based relaxation model, pulling users down a strict ladder over 2 minutes regardless of actual queue liquidity. Gender preferences were treated as "OR", leading to mismatched expectations.
**Decision:** We will replace the entire engine with a Candidate Ranking Model. All waiting users are scored dynamically. Match Modes (Random, Smart, Exact) apply distinct Priority Ladders, sorting by score. 
**Consequences:** Significant PL/pgSQL rewrite. Instant fallback capabilities. Prevents starvation and ensures maximum connection rate while respecting preferences.

## ADR-004: Data Retention & Cleanup
**Status:** Approved
**Decision:** All inactive sessions are purged from `visitor_sessions` via cascading deletes triggered by client `sendBeacon` or ungraceful disconnection.

## ADR-003: Matchmaking Concurrency
**Status:** Approved
**Decision:** Use `SELECT ... FOR UPDATE SKIP LOCKED` inside Supabase PL/pgSQL RPCs to atomically claim candidates without duplicate matches.

## ADR-002: Authentication Model
**Status:** Approved
**Decision:** Use Supabase Anonymous Sessions instead of rolling custom JWTs in Cloudflare.

## ADR-001: Signaling Transport
**Status:** Approved
**Decision:** Use Supabase Realtime Channels (bypassing Cloudflare Workers for WebSocket connections) to solve 1-minute timeout limits and optimize latency.
