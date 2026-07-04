import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

// TEMPORARY MVP DEFAULTS - Fallback credentials for fast local development
const DEFAULT_SUPABASE_URL = "https://dirocenpssdilkztizps.supabase.co";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcm9jZW5wc3NkaWxrenRpenBzIiwicm9sZSIsImlhdCI6MTc4Mjc1NjUzNSwiZXhwIjoyMDk4MzMyNTM1fQ.aBefMcx8RACTKBTOTuqweuDRT7X284Unfv4xbEFa5NE";

export const config = {
  port: parseInt(optionalEnv('PORT', '5000'), 10),
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
  supabaseUrl: DEFAULT_SUPABASE_URL,
  supabaseServiceRoleKey: DEFAULT_SUPABASE_SERVICE_ROLE_KEY,
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
  stunServers: optionalEnv(
    'STUN_SERVERS',
    'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  queueStaleMs: 5 * 60 * 1000,
  matchStaleMs: 30 * 60 * 1000,
  metricsIntervalMs: 60 * 1000,
  cleanupIntervalMs: 30 * 1000,
};

export function getIceServers() {
  return config.stunServers.map((url) => ({ urls: url }));
}
