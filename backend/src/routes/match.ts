import { Router } from 'express';
import {
  joinQueue,
  leaveQueue,
  markMatchReady,
  nextPartner,
  notifyPartnerLeft,
  getMatchStatus,
} from '../services/matchService.js';
import { queueLimiter } from '../middleware/queueLimiter.js';

const router = Router();

router.post('/join', queueLimiter, async (req, res, next) => {
  try {
    const { sessionId, sessionToken } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    const result = await joinQueue(sessionId, sessionToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/status', queueLimiter, async (req, res, next) => {
  try {
    // Get headers
    const sessionId = req.headers['x-session-id'] as string;
    const sessionToken = req.headers['x-session-token'] as string;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'x-session-id and x-session-token headers are required' });
    }
    const result = await getMatchStatus(sessionId, sessionToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/leave', queueLimiter, async (req, res, next) => {
  try {
    const { sessionId, sessionToken, matchId } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    await leaveQueue(sessionId, sessionToken, matchId);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message && err.message.includes('Illegal state transition')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
});

router.post('/next', queueLimiter, async (req, res, next) => {
  try {
    const { sessionId, sessionToken, matchId, reason } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    const result = await nextPartner(sessionId, sessionToken, matchId, reason || 'next');
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message && err.message.includes('Illegal state transition')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
});

router.post('/disconnect', queueLimiter, async (req, res, next) => {
  try {
    const { sessionId, sessionToken, reason, matchId } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    await notifyPartnerLeft(sessionId, sessionToken, reason ?? 'disconnect', matchId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/ready', queueLimiter, async (req, res, next) => {
  try {
    const { sessionId, sessionToken, matchId } = req.body;
    if (!sessionId || !sessionToken || !matchId) {
      return res.status(400).json({ success: false, error: 'sessionId, sessionToken, and matchId are required' });
    }
    const result = await markMatchReady(sessionId, sessionToken, matchId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[API /ready endpoint error]', err);
    res.status(422).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark match ready',
    });
  }
});

router.post('/connected', queueLimiter, async (req, res, next) => {
  try {
    const { sessionId, sessionToken, matchId } = req.body;
    if (!sessionId || !sessionToken || !matchId) {
      return res.status(400).json({ success: false, error: 'sessionId, sessionToken, and matchId are required' });
    }
    const { markMediaConnected } = await import('../services/matchService.js');
    const result = await markMediaConnected(sessionId, sessionToken, matchId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[API /connected endpoint error]', err);
    res.status(422).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark media connected',
    });
  }
});

export default router;
