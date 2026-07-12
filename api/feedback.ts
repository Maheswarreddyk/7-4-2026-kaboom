import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppError, json, withHandler } from './_lib/handler.js';
import { submitFeedback } from './_lib/services.js';
import { applyRateLimit, RateLimits } from './_lib/rateLimiter.js';

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    throw new AppError(405, 'Method not allowed');
  }
  if (!applyRateLimit(req, res, 'feedback', RateLimits.feedback.maxReqs, RateLimits.feedback.windowMs)) return;

  const { sessionId, rating, feedback } = req.body ?? {};

  if (!sessionId || typeof rating !== 'number') {
    throw new AppError(400, 'sessionId and rating are required');
  }

  if (rating < 1 || rating > 5) {
    throw new AppError(400, 'Rating must be between 1 and 5');
  }

  const entry = await submitFeedback({ sessionId, rating, feedback });
  json(res, 201, { success: true, data: entry });
});
