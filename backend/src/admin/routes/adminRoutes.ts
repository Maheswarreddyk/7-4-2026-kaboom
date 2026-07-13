import { Router, type Request, type Response, type NextFunction } from 'express';
import { adminController } from '../controllers/adminController.js';
import rateLimit from 'express-rate-limit';
import { environment } from 'config';

// ============================================================
// Admin Rate Limiter — 60 requests per minute per IP
// Less strict than API limiter (dashboards auto-refresh)
// ============================================================
const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Slow down.' },
});

// ============================================================
// requireAdminAuth middleware
// Checks Authorization: Bearer <ADMIN_TOKEN> header
// ============================================================
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const adminToken = environment.admin?.adminToken;

  // If ADMIN_TOKEN is not configured in env, refuse all access
  if (!adminToken) {
    return res.status(503).json({
      error: 'Admin access is not configured. Set ADMIN_TOKEN environment variable.',
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.slice(7); // strip "Bearer "
  if (token !== adminToken) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  next();
}

// ============================================================
// Admin Router — All GET. All read-only. No writes.
// ============================================================
const adminRouter = Router();

adminRouter.use(adminRateLimiter);
adminRouter.use(requireAdminAuth);

// Overview / home dashboard
adminRouter.get('/overview', adminController.getOverview);

// Live users with status breakdown
adminRouter.get('/live-users', adminController.getLiveUsers);

// Geographic distribution
adminRouter.get('/locations', adminController.getLocations);

// College / university usage
adminRouter.get('/colleges', adminController.getColleges);

// Filter preferences (interests, languages, gender, etc.)
adminRouter.get('/filters', adminController.getFilters);

// Device breakdown (browser, device type, platform)
adminRouter.get('/devices', adminController.getDevices);

// Real-time queue snapshot
adminRouter.get('/queue', adminController.getQueue);

// Match analytics
adminRouter.get('/matches', adminController.getMatches);

// Metrics history (server_metrics table snapshots)
adminRouter.get('/metrics-history', adminController.getMetricsHistory);

export default adminRouter;
