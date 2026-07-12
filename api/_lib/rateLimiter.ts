/**
 * api/_lib/rateLimiter.ts
 *
 * Phase 1D: In-process sliding-window rate limiter for Vercel serverless functions.
 *
 * Design decisions:
 * - In-memory only. No external dependency (no Redis, no Upstash).
 *   Rationale: Introducing infrastructure dependencies requires a separate phase.
 *   In-memory provides meaningful protection against burst abuse on warm instances.
 * - Sliding window (not fixed window) to prevent boundary-spike exploits.
 * - Map is keyed by IP address, not session ID, so unauthenticated requests
 *   (e.g., spam to /start-session) are also rate-limited.
 * - Map entries expire automatically after the window to prevent unbounded growth.
 * - Returns HTTP 429 with a Retry-After header on violation.
 *
 * Limitations (to be addressed in Phase 7 — Security):
 * - State resets on cold start / new instance allocation.
 * - Does not protect against distributed attacks across multiple instances.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface WindowEntry {
  timestamps: number[];
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

const store = new Map<string, WindowEntry>();

/**
 * Extract the real client IP from the request, accounting for proxies.
 */
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket as any)?.remoteAddress ?? 'unknown';
}

/**
 * Apply a sliding-window rate limit.
 *
 * @param req       The Vercel request object
 * @param res       The Vercel response object
 * @param key       Unique key for this limit bucket (e.g., 'join' or 'session')
 * @param maxReqs   Maximum number of requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 * @returns true if the request is allowed, false if rate-limited (response already sent)
 */
export function applyRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  key: string,
  maxReqs: number,
  windowMs: number
): boolean {
  const ip = getClientIp(req);
  const storeKey = `${key}:${ip}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(storeKey);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(storeKey, entry);
  }

  // Slide the window: discard timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= maxReqs) {
    // Rate limit exceeded
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    res.setHeader('Retry-After', String(retryAfterSec));
    res.setHeader('X-RateLimit-Limit', String(maxReqs));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfterSeconds: retryAfterSec,
    });
    return false;
  }

  // Request is allowed — record this timestamp
  entry.timestamps.push(now);

  // Schedule cleanup of the store entry after the window expires so the
  // Map does not grow unbounded over a long-lived warm instance lifetime.
  if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
  entry.cleanupTimer = setTimeout(() => {
    store.delete(storeKey);
  }, windowMs + 1000);

  return true;
}

/**
 * Pre-configured rate limit profiles for each endpoint category.
 * These are intentionally generous to avoid blocking legitimate users
 * on shared IPs (college NAT, mobile carrier NAT).
 *
 * Values derived from Phase 1 investigation report (Step 4 — Endpoint Classification).
 */
export const RateLimits = {
  /** /match/join — polled every 4s per user. 60/min = 4× headroom. */
  matchJoin:        { maxReqs: 60,  windowMs: 60_000 },
  /** /match/ready — called once per match. 30/min = generous headroom for retries. */
  matchReady:       { maxReqs: 30,  windowMs: 60_000 },
  /** /match/next — user action, not a heartbeat. */
  matchNext:        { maxReqs: 30,  windowMs: 60_000 },
  /** /match/disconnect and /match/leave — lifecycle events. */
  matchLifecycle:   { maxReqs: 60,  windowMs: 60_000 },
  /** /start-session — session creation. High risk for bot abuse. */
  startSession:     { maxReqs: 5,   windowMs: 60 * 60_000 }, // 5 per hour
  /** /end-session */
  endSession:       { maxReqs: 20,  windowMs: 60_000 },
  /** /preferences — user settings update */
  preferences:      { maxReqs: 30,  windowMs: 60_000 },
  /** /chat — messaging. 30/min allows bursts without spam. */
  chat:             { maxReqs: 30,  windowMs: 60_000 },
  /** /like */
  like:             { maxReqs: 10,  windowMs: 60_000 },
  /** /report — trust & safety. Low limit by design. */
  report:           { maxReqs: 5,   windowMs: 60 * 60_000 }, // 5 per hour
  /** /feedback */
  feedback:         { maxReqs: 5,   windowMs: 60 * 60_000 }, // 5 per hour
  /** /stats — analytics polling */
  stats:            { maxReqs: 20,  windowMs: 60_000 },
  /** /analytics */
  analytics:        { maxReqs: 10,  windowMs: 60 * 60_000 }, // 10 per hour
  /** /interests, /locations — search autocomplete */
  search:           { maxReqs: 30,  windowMs: 60_000 },
  /** /health — monitoring */
  health:           { maxReqs: 60,  windowMs: 60_000 },
} as const;
