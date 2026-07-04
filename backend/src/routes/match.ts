import { Router } from 'express';
import {
  joinQueue,
  leaveQueue,
  markMatchReady,
  nextPartner,
  notifyPartnerLeft,
} from '../services/matchService.js';

const router = Router();

router.post('/join', async (req, res, next) => {
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

router.post('/leave', async (req, res, next) => {
  try {
    const { sessionId, sessionToken } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    await leaveQueue(sessionId, sessionToken);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/next', async (req, res, next) => {
  try {
    const { sessionId, sessionToken } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    const result = await nextPartner(sessionId, sessionToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/disconnect', async (req, res, next) => {
  try {
    const { sessionId, sessionToken, reason } = req.body;
    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'sessionId and sessionToken are required' });
    }
    await notifyPartnerLeft(sessionId, sessionToken, reason ?? 'disconnect');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/ready', async (req, res, next) => {
  try {
    const { sessionId, sessionToken, matchId } = req.body;
    if (!sessionId || !sessionToken || !matchId) {
      return res.status(400).json({ error: 'sessionId, sessionToken, and matchId are required' });
    }
    const result = await markMatchReady(sessionId, sessionToken, matchId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
