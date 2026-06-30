import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppError, json, withHandler } from './lib/handler.js';
import { startSession } from './lib/services.js';

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    throw new AppError(405, 'Method not allowed');
  }

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
