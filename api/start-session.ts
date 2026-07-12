import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppError, json, withHandler } from './_lib/handler.js';
import { startSession } from './_lib/services.js';
import { applyRateLimit, RateLimits } from './_lib/rateLimiter.js';

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    throw new AppError(405, 'Method not allowed');
  }
  if (!applyRateLimit(req, res, 'start-session', RateLimits.startSession.maxReqs, RateLimits.startSession.windowMs)) return;

  const { country, browser, device, platform } = req.body ?? {};
  const session = await startSession({ country, browser, device, platform });

  json(res, 201, {
    success: true,
    data: {
      sessionId: session.id,
      sessionToken: session.session_token,
      createdAt: session.created_at,
    },
  });
});
