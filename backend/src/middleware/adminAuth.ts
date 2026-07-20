

// Read from env var — fallback to local dev token
const MVP_ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export const requireAdminToken = (c: any, next: any) => {
  const authHeader = c.req.header().authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!MVP_ADMIN_TOKEN || token !== MVP_ADMIN_TOKEN) {
    res.status(403).json({ error: 'Forbidden: Invalid admin token' });
    return;
  }

  next();
};
