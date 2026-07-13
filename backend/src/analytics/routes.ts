import { Router, type Request, type Response, type NextFunction } from 'express';
import { analyticsService } from './service.js';
import { environment } from 'config';

const analyticsRouter = Router();

// ============================================================
// Simple MVP Auth Guard (Mahes@123)
// ============================================================
function requireAnalyticsAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.slice(7);
  // MVP hardcoded password as requested
  if (token !== 'Mahes@123' && token !== environment.admin?.adminToken) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }

  next();
}

analyticsRouter.use(requireAnalyticsAuth);

analyticsRouter.get('/live-overview', async (req, res, next) => {
  try {
    const data = await analyticsService.getLiveOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/live-users', async (req, res, next) => {
  try {
    const data = await analyticsService.getLiveUsers();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/historical-overview', async (req, res, next) => {
  try {
    const data = await analyticsService.getHistoricalOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/campus', async (req, res, next) => {
  try {
    const data = await analyticsService.getCampusAnalytics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default analyticsRouter;
