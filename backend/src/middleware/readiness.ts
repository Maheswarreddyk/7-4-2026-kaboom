import { Request, Response, NextFunction } from 'express';
import { startupManager } from '../utils/startupState.js';

export const requireBackendReady = (req: Request, res: Response, next: NextFunction) => {
  const state = startupManager.getState();
  
  if (state !== 'READY') {
    return res.status(503).json({
      ready: false,
      message: 'Kaboom is warming up. Please wait a moment.',
      status: state,
    });
  }
  
  next();
};
