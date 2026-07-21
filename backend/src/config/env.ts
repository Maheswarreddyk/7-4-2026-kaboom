import type { Env } from '../index.js';

export function getConfig(env?: Env) {
  const e = env || (globalThis.process ? globalThis.process.env : {}) as any;

  return {
    port: parseInt(e.PORT || '5000', 10),
    frontendUrl: e.FRONTEND_URL || 'https://kaboom-tv.com',
    allowedOrigins: (e.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://localhost:5000,http://localhost:10000,https://kaboom-tv.com,https://www.kaboom-tv.com,https://api.kaboom-tv.com,https://seven-4-2026-kaboom-1a.onrender.com')
      .split(',')
      .map((o: string) => o.trim())
      .filter(Boolean),
    supabaseUrl: e.SUPABASE_URL || 'https://dirocenpssdilkztizps.supabase.co',
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY || '',
    nodeEnv: e.NODE_ENV || 'production',
    isProduction: (e.NODE_ENV || 'production') === 'production',
    stunServers: (e.STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean),
    turnServer: e.TURN_SERVER || '',
    turnUsername: e.TURN_USERNAME || '',
    turnPassword: e.TURN_PASSWORD || '',
    queueStaleMs: parseInt(e.QUEUE_TIMEOUT || '300', 10) * 1000,
    matchStaleMs: parseInt(e.MATCH_TIMEOUT || '1800', 10) * 1000,
    metricsIntervalMs: 60 * 1000,
    cleanupIntervalMs: 5 * 1000,
    adminToken: e.ADMIN_TOKEN || '',
  };
}
