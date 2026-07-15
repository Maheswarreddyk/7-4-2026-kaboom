import { Request, Response, NextFunction } from 'express';

// In-memory locks and throttles (Instance-local)
const queueLocks = new Set<string>();
const queueTimestamps = new Map<string, number>();

const QUEUE_COOLDOWN_MS = 1000;

// Phase 4: Prevent memory leak by cleaning up old timestamps every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of queueTimestamps.entries()) {
    if (now - timestamp > QUEUE_COOLDOWN_MS * 10) {
      queueTimestamps.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export const queueLimiter = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    // If no sessionId, just pass through (let the route handler fail it)
    return next();
  }

  const now = Date.now();
  const lockKey = `${sessionId}:${req.path}`;

  // 1. Concurrency Lock: Prevent multiple requests for the same endpoint at exactly the same time
  if (queueLocks.has(lockKey)) {
    console.warn(`[QueueLimiter] Rejected concurrent request for session ${sessionId} (${req.path})`);
    return res.status(429).json({ success: false, error: 'Request already in progress.' });
  }

  // 2. Throttling: Prevent rapid sequential requests to the same endpoint
  const lastTime = queueTimestamps.get(lockKey) || 0;
  if (now - lastTime < QUEUE_COOLDOWN_MS) {
    console.warn(`[QueueLimiter] Rejected rapid request for session ${sessionId} (${req.path})`);
    return res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment.' });
  }

  // Acquire lock and update timestamp
  queueLocks.add(lockKey);
  queueTimestamps.set(lockKey, now);

  // Release the lock when the response finishes or errors
  res.on('finish', () => {
    queueLocks.delete(lockKey);
  });

  res.on('close', () => {
    queueLocks.delete(lockKey);
  });

  next();
};
