import { Hono } from 'hono';
import { cors } from 'hono/cors';
// Trigger backend auto-deploy with Node 22
import { secureHeaders } from 'hono/secure-headers';
import routes from './routes/index.js';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ADMIN_TOKEN: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://kaboom-tv.com',
      'https://www.kaboom-tv.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      return origin;
    }
    // Allow Pages preview deployments ending in .pages.dev
    if (origin.endsWith('.pages.dev')) {
      return origin;
    }
    return 'https://kaboom-tv.com';
  },
  credentials: true,
}));

import { envStorage } from './context.js';

app.use('*', secureHeaders());

app.use('*', async (c, next) => {
  (globalThis as any).__env = c.env;
  return envStorage.run(c.env, () => next());
});

app.use('*', async (c, next) => {
  console.log('[Request] ' + c.req.method + ' ' + c.req.url);
  await next();
});

app.get('/api/debug-env', async (c) => {
  const keys = c.env ? Object.keys(c.env) : [];
  try {
    const { getSupabase } = await import('./database/client.js');
    const supabase = getSupabase();
    const { data, error, status, statusText } = await supabase.from('waiting_queue').select('id').limit(1);
    return c.json({ keys, dbData: data, dbError: error, status, statusText });
  } catch (err: any) {
    return c.json({ keys, catchError: err.message, stack: err.stack });
  }
});


app.onError((err, c) => {
  console.error('[Global Error]', err);
  return c.json({ error: err.message, stack: err.stack, name: err.name }, 500);
});


app.route('/api', routes);

export default {
  fetch: app.fetch
};
