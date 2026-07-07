import { environment } from 'config';

export const config = {
  port:                   environment.backend.port,
  frontendUrl:            environment.backend.frontendUrl,
  allowedOrigins:         environment.backend.allowedOrigins,
  supabaseUrl:            environment.supabase.url,
  supabaseServiceRoleKey: environment.supabase.serviceRoleKey,
  nodeEnv:                environment.nodeEnv,
  isProduction:           environment.nodeEnv === 'production',
  stunServers:            environment.webrtc.stunServers,
  queueStaleMs:           environment.backend.queueTimeout * 1000,
  matchStaleMs:           environment.backend.matchTimeout * 1000,
  metricsIntervalMs:      60 * 1000,
  cleanupIntervalMs:      30 * 1000,
};

export function getIceServers() {
  return config.stunServers.map((url: string) => ({ urls: url }));
}
