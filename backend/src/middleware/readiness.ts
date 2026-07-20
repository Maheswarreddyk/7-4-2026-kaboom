
import { startupManager } from '../utils/startupState.js';

export const requireBackendReady = (c: any, next: any) => {
  const state = startupManager.getState();
  
  if (state !== 'READY') {
    return c.json({status: "ok"});
  }
  
  next();
};
