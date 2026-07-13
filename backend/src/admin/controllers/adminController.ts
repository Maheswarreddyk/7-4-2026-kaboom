import type { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/adminService.js';

// ============================================================
// Admin Controller — HTTP request handlers for /api/admin/*
// Each handler returns clean JSON with consistent shape.
// ============================================================

export const adminController = {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getOverview();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getLiveUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getLiveUsers();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getLocations(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getLocations();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getColleges(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getColleges();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getFilters(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getFilters();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getDevices(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getDevices();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getQueue();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getMatches(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getMatches();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getMetricsHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 60;
      const data = await adminService.getMetricsHistory(limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
