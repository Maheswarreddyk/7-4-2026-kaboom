import { Router } from 'express';
import { analyticsService } from './service.js';
import { etlService } from './etlService.js';
import { requireAdminToken } from '../middleware/adminAuth.js';

const router = Router();

router.use(requireAdminToken);

router.post('/sync', async (req, res) => {
  try {
    const result = await etlService.syncAnalytics();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const data = await analyticsService.getOverview();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/trends', async (req, res) => {
  try {
    const data = await analyticsService.getTrends();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audience', async (req, res) => {
  try {
    const data = await analyticsService.getAudience();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/match-analytics', async (req, res) => {
  try {
    const data = await analyticsService.getMatchAnalytics();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const data = await analyticsService.getNotifications();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/live-feed', async (req, res) => {
  try {
    const data = await analyticsService.getActivityFeed();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as analyticsRouter };
