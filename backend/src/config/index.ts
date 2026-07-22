import { getEnv } from '../context.js';

export const config = {
  get port() { return parseInt((getEnv().PORT as string) || '5000', 10); },
  get frontendUrl() { return (getEnv().FRONTEND_URL as string) || 'https://kaboom-tv.com'; },
  get allowedOrigins() {
    return ((getEnv().ALLOWED_ORIGINS as string) || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://localhost:5000,http://localhost:10000,https://kaboom-tv.com,https://www.kaboom-tv.com,https://api.kaboom-tv.com,https://seven-4-2026-kaboom-1a.onrender.com')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
  },
  get supabaseUrl() { return (getEnv().SUPABASE_URL as string) || 'https://dirocenpssdilkztizps.supabase.co'; },
  get supabaseServiceRoleKey() { return (getEnv().SUPABASE_SERVICE_ROLE_KEY as string) || ''; },
  get nodeEnv() { return (getEnv().NODE_ENV as string) || 'production'; },
  get isProduction() { return this.nodeEnv === 'production'; },
  get stunServers() {
    return ((getEnv().STUN_SERVERS as string) || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  },
  get turnServer() { return (getEnv().TURN_SERVER as string) || ''; },
  get turnUsername() { return (getEnv().TURN_USERNAME as string) || ''; },
  get turnPassword() { return (getEnv().TURN_PASSWORD as string) || ''; },
  get queueStaleMs() { return parseInt((getEnv().QUEUE_TIMEOUT as string) || '300', 10) * 1000; },
  get matchStaleMs() { return parseInt((getEnv().MATCH_TIMEOUT as string) || '1800', 10) * 1000; },
  get metricsIntervalMs() { return 60 * 1000; },
  get cleanupIntervalMs() { return 5 * 1000; },
  get adminToken() { return (getEnv().ADMIN_TOKEN as string) || ''; },
};

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function getIceServers(): IceServer[] {
  return [
    {
      urls: "stun:stun.relay.metered.ca:80",
    },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "75ce0488e2b6dd463873fe19",
      credential: "86h9uzIutQ27P3Mq",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "75ce0488e2b6dd463873fe19",
      credential: "86h9uzIutQ27P3Mq",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "75ce0488e2b6dd463873fe19",
      credential: "86h9uzIutQ27P3Mq",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "75ce0488e2b6dd463873fe19",
      credential: "86h9uzIutQ27P3Mq",
    },
  ];
}
