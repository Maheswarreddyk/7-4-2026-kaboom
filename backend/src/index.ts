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

app.use('*', secureHeaders());

app.use('*', async (c, next) => {
  globalThis.process = globalThis.process || { env: {} };
  globalThis.process.env = { ...globalThis.process.env, ...c.env };
  await next();
});

app.use('*', async (c, next) => {
  console.log('[Request] ' + c.req.method + ' ' + c.req.url);
  await next();
});

app.route('/api', routes);

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Env, ctx: any) {
    globalThis.process = globalThis.process || { env: {} };
    globalThis.process.env = { ...globalThis.process.env, ...env };
    
    // Dynamic import to avoid evaluating everything globally at cold start
    const { runGlobalMatchCycle, runGlobalHealCycle } = await import('./matchmaking/matchingEngine.js');
    const { getSupabase } = await import('./database/client.js');
    
    const supabase = getSupabase();
    
    ctx.waitUntil(runGlobalHealCycle(supabase).catch(console.error));
    await runGlobalMatchCycle(supabase).catch(console.error);
  }
};
