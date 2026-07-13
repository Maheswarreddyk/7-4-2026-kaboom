import { Router } from 'express';
import { analyticsService } from './service.js';
import { requireAdminToken } from '../middleware/adminAuth.js';

const router = Router();

// MVP Auth Guard for all admin routes
router.use(requireAdminToken);

// I. Platform Overview (Mission Control)
router.get('/mission-control', async (req, res) => {
  try {
    const data = await analyticsService.getMissionControl();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// II. Product Intelligence
router.get('/search-demand', async (req, res) => {
  try {
    const data = await analyticsService.getSearchDemand();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/match-quality', async (req, res) => {
  try {
    const data = await analyticsService.getMatchQuality();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/campus-leaderboard', async (req, res) => {
  try {
    const data = await analyticsService.getCampusLeaderboard();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// III. Growth & Campaigns
router.get('/funnel', async (req, res) => {
  try {
    const data = await analyticsService.getFunnel();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// IV. Operations (Live Data)
router.get('/live-sessions', async (req, res) => {
  try {
    const data = await analyticsService.getLiveSessions();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
