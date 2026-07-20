import { Router } from 'express';
import { analyticsService } from './service.js';
import { etlService } from './etlService.js';
import { requireAdminToken } from '../middleware/adminAuth.js';

const router = Router();

router.use(requireAdminToken);

router.post('/sync', async (c) => {
  try {
    const result = await etlService.syncAnalytics();
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message });
  }
});

router.get('/overview', async (c) => {
  try {
    const data = await analyticsService.getOverview();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message });
  }
});

router.get('/trends', async (c) => {
  try {
    const data = await analyticsService.getTrends();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message });
  }
});

router.get('/audience', async (c) => {
  try {
    const data = await analyticsService.getAudience();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message });
  }
});

router.get('/match-analytics', async (c) => {
  try {
    const data = await analyticsService.getMatchAnalytics();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message });
  }
});

router.get('/notifications', async (c) => {
  try {
    const data = await analyticsService.getNotifications();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message });
  }
});

router.get('/live-feed', async (c) => {
  try {
    const data = await analyticsService.getActivityFeed();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message });
  }
});

export { router as analyticsRouter };
