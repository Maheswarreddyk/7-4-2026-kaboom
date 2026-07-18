import rateLimit from 'express-rate-limit';

const skipLocalhost = (req: any) => {
  return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
};

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000, // increased from 200 for testing
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalhost,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});

export const sessionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10000, // increased from 20 for testing
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalhost,
  message: {
    success: false,
    error: 'Session creation rate limit exceeded.',
  },
});

export const reportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalhost,
  message: {
    success: false,
    error: 'Report submission rate limit exceeded.',
  },
});
