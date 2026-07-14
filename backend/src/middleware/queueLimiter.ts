import { Request, Response, NextFunction } from 'express';

// In-memory locks and throttles (Instance-local)
const queueLocks = new Set<string>();
const queueTimestamps = new Map<string, number>();

const QUEUE_COOLDOWN_MS = 1000;

export const queueLimiter = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    // If no sessionId, just pass through (let the route handler fail it)
    return next();
  }

  const now = Date.now();

  // 1. Concurrency Lock: Prevent multiple requests for the same session at exactly the same time
  if (queueLocks.has(sessionId)) {
    console.warn(`[QueueLimiter] Rejected concurrent request for session ${sessionId} (${req.path})`);
    return res.status(429).json({ success: false, error: 'Request already in progress.' });
  }

  // 2. Throttling: Prevent rapid sequential requests
  const lastTime = queueTimestamps.get(sessionId) || 0;
  if (now - lastTime < QUEUE_COOLDOWN_MS) {
    console.warn(`[QueueLimiter] Rejected rapid request for session ${sessionId} (${req.path})`);
    return res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment.' });
  }

  // Acquire lock and update timestamp
  queueLocks.add(sessionId);
  queueTimestamps.set(sessionId, now);

  // Release the lock when the response finishes or errors
  res.on('finish', () => {
    queueLocks.delete(sessionId);
  });

  res.on('close', () => {
    queueLocks.delete(sessionId);
  });

  next();
};
