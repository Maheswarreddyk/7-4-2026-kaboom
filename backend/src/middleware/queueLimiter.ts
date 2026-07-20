import type { Context, Next } from 'hono';

const queueLocks = new Set<string>();
const queueTimestamps = new Map<string, number>();

const QUEUE_COOLDOWN_MS = 1000;

export const queueLimiter = async (c: Context, next: Next) => {
  let body: any = {};
  try {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else if (contentType) {
      body = await c.req.parseBody();
    }
  } catch(e) {}
  
  const sessionId = body?.sessionId;
  if (!sessionId) return next();

  const now = Date.now();
  const lockKey = sessionId + ':' + c.req.path;

  if (queueLocks.has(lockKey)) {
    console.warn('[QueueLimiter] Rejected concurrent request for session ' + sessionId + ' (' + c.req.path + ')');
    return c.json({ success: false, error: 'Request already in progress.' }, 429);
  }

  const lastTime = queueTimestamps.get(lockKey) || 0;
  if (now - lastTime < QUEUE_COOLDOWN_MS) {
    console.warn('[QueueLimiter] Rejected rapid request for session ' + sessionId + ' (' + c.req.path + ')');
    return c.json({ success: false, error: 'Too many requests. Please wait a moment.' }, 429);
  }

  queueLocks.add(lockKey);
  queueTimestamps.set(lockKey, now);

  try {
    await next();
  } finally {
    queueLocks.delete(lockKey);
    
    if (Math.random() < 0.05) {
      const expiration = Date.now() - (QUEUE_COOLDOWN_MS * 10);
      for (const [key, timestamp] of queueTimestamps.entries()) {
        if (timestamp < expiration) queueTimestamps.delete(key);
      }
    }
  }
};

