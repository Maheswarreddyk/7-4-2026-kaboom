import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '../database/client.js';
import { matchmakerMetrics } from '../matchmaking/matchingEngine.js';
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
  getHealth: asyncHandler(async (_req: Request, res: Response) => {
    const startupProgress = startupManager.getProgressInfo();
    
    res.json({
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
  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await statsService.getStats(matchmakerMetrics.totalSearchingUsers);
    res.json({ success: true, data: stats });
  }),
};

export const sessionController = {
  startSession: asyncHandler(async (req: Request, res: Response) => {
    const { country, browser, device, platform } = req.body ?? {};

    const session = await sessionService.startSession({
      country,
      browser,
      device,
      platform,
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        sessionToken: session.session_token,
        createdAt: session.created_at,
        status: session.status,
      },
    });
  }),

  endSession: asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.body ?? {};

    if (!sessionId || typeof sessionId !== 'string') {
      throw new AppError(400, 'sessionId is required');
    }

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new AppError(404, 'Session not found');
    }

    await sessionService.endSession(sessionId);

    res.json({ success: true, message: 'Session ended' });
  }),

  restoreSession: asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, sessionToken } = req.body ?? {};

    if (!sessionId || !sessionToken) {
      throw new AppError(400, 'sessionId and sessionToken are required');
    }

    const session = await sessionService.restoreSession(sessionId, sessionToken);
    if (!session) {
      throw new AppError(401, 'Invalid or expired session');
    }

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        sessionToken: session.session_token,
        createdAt: session.created_at,
        status: session.status,
      },
    });
  }),
};

export const reportController = {
  submitReport: asyncHandler(async (req: Request, res: Response) => {
    const { reporterSessionId, reportedSessionId, reason, notes } = req.body ?? {};

    if (!reporterSessionId || !reportedSessionId || !reason) {
      throw new AppError(400, 'reporterSessionId, reportedSessionId, and reason are required');
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

    res.status(201).json({ success: true, data: report });
  }),
};

export const feedbackController = {
  submitFeedback: asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, rating, feedback } = req.body ?? {};

    if (!sessionId || typeof rating !== 'number') {
      throw new AppError(400, 'sessionId and rating are required');
    }

    if (rating < 1 || rating > 5) {
      throw new AppError(400, 'Rating must be between 1 and 5');
    }

    const entry = await feedbackService.submitFeedback({ sessionId, rating, feedback });

    res.status(201).json({ success: true, data: entry });
  }),
};
