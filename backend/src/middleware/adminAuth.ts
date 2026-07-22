// Read from env var — fallback to local dev token

import { config } from '../config/index.js';

export const requireAdminToken = async (c: any, next: any) => {
  const MVP_ADMIN_TOKEN = config.adminToken;
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }

  const token = authHeader.split(' ')[1];
  if (!MVP_ADMIN_TOKEN || token !== MVP_ADMIN_TOKEN) {
    return c.json({ error: 'Forbidden: Invalid admin token' }, 403);
  }

  await next();
};
