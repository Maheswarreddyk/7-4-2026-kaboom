
import { checkDatabaseConnection } from '../database/client.js';
import {
  feedbackService,
  reportService,
  sessionService,
  statsService,
} from '../services/index.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import type { ReportReason } from '../types/index.js';
import { startupManager } from '../utils/startupState.js';

const VALID_REPORT_REASONS: ReportReason[] = ['spam', 'nudity', 'abuse', 'harassment', 'other'];

export const healthController = {
  getHealth: asyncHandler(async (c: any) => {
    const startupProgress = startupManager.getProgressInfo();
    
    return c.json({
      success: true,
      ready: startupProgress.state === 'READY' || startupProgress.state === 'DEGRADED',
      status: startupProgress.state,
      progress: startupProgress.progress,
      stage: startupProgress.stage,
      version: startupManager.getVersion(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }),
};

export const statsController = {
  getStats: asyncHandler(async (c: any) => {
    const { getSupabase } = await import('../database/client.js');
    const { count } = await getSupabase().from('waiting_queue').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
    const stats = await statsService.getStats(count || 0);
    return c.json({ success: true, data: stats });
  }),
};

export const sessionController = {
  startSession: asyncHandler(async (c: any) => {
    const payload = (await c.req.json().catch(() => {})) ?? {};
    let { country, browser, device, platform } = payload;
    
    if (!country) {
      country = c.req.header('cf-ipcountry') || c.req.header('x-real-ip') || 'Unknown';
    }

    let authUserId: string | undefined;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { getSupabase } = await import('../database/client.js');
      const supabase = getSupabase();
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        authUserId = user.id;
      }
    }

    const session = await sessionService.startSession({
      authUserId,
      country,
      browser,
      device,
      platform,
    });

    return c.json({
      success: true,
      data: {
        sessionId: session.id,
        sessionToken: session.session_token,
        createdAt: session.created_at,
        status: session.status,
      },
    }, 201);
  }),

  endSession: asyncHandler(async (c: any) => {
    const { sessionId, sessionToken } = (await c.req.json()) ?? {};

    if (!sessionId || !sessionToken || typeof sessionId !== 'string') {
      throw new AppError(400, 'sessionId and sessionToken are required');
    }

    const { validateSession } = await import('../services/matchService.js');
    const session = await validateSession(sessionId, sessionToken);
    if (!session) {
      throw new AppError(401, 'Invalid or expired session');
    }

    await sessionService.endSession(sessionId);

    return c.json({ success: true, message: 'Session ended' });
  }),

  restoreSession: asyncHandler(async (c: any) => {
    const { sessionId, sessionToken } = (await c.req.json()) ?? {};

    if (!sessionId || !sessionToken) {
      throw new AppError(400, 'sessionId and sessionToken are required');
    }

    const result = await sessionService.restoreSession(sessionId, sessionToken);
    if (!result) {
      throw new AppError(401, 'Invalid or expired session');
    }

    const { session, match } = result;

    return c.json({
      success: true,
      data: {
        sessionId: session.id,
        sessionToken: session.session_token,
        createdAt: session.created_at,
        status: session.status,
        activeMatch: match ? {
          matchId: match.id,
          partnerSessionId: match.user_a === session.id ? match.user_b : match.user_a,
          isInitiator: match.user_a === session.id, // Or however we determine initiator if necessary, but usually webRTC will just resume or reconnect based on state.
        } : null
      },
    });
  }),
};

export const reportController = {
  submitReport: asyncHandler(async (c: any) => {
    const { reporterSessionId, reporterSessionToken, reportedSessionId, reason, notes } = (await c.req.json()) ?? {};

    if (!reporterSessionId || !reporterSessionToken || !reportedSessionId || !reason) {
      throw new AppError(400, 'reporterSessionId, reporterSessionToken, reportedSessionId, and reason are required');
    }

    const { validateSession } = await import('../services/matchService.js');
    const session = await validateSession(reporterSessionId, reporterSessionToken);
    if (!session) {
      throw new AppError(401, 'Invalid or expired session');
    }

    if (!VALID_REPORT_REASONS.includes(reason)) {
      throw new AppError(400, `Invalid reason. Must be one of: ${VALID_REPORT_REASONS.join(', ')}`);
    }

    const report = await reportService.submitReport({
      reporterSessionId,
      reportedSessionId,
      reason,
      notes,
    });

    return c.json({ success: true, data: report }, 201);
  }),
};

export const feedbackController = {
  submitFeedback: asyncHandler(async (c: any) => {
    const { sessionId, sessionToken, rating, feedback } = (await c.req.json()) ?? {};

    if (!sessionId || !sessionToken || typeof rating !== 'number') {
      throw new AppError(400, 'sessionId, sessionToken, and rating are required');
    }

    const { validateSession } = await import('../services/matchService.js');
    const session = await validateSession(sessionId, sessionToken);
    if (!session) {
      throw new AppError(401, 'Invalid or expired session');
    }

    if (rating < 1 || rating > 5) {
      throw new AppError(400, 'Rating must be between 1 and 5');
    }

    const entry = await feedbackService.submitFeedback({ sessionId, rating, feedback });

    return c.json({ success: true, data: entry }, 201);
  }),
};
