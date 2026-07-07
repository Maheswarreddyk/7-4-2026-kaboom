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
  turnServer:             environment.webrtc.turnServer,
  turnUsername:           environment.webrtc.turnUsername,
  turnPassword:           environment.webrtc.turnPassword,
  queueStaleMs:           environment.backend.queueTimeout * 1000,
  matchStaleMs:           environment.backend.matchTimeout * 1000,
  metricsIntervalMs:      60 * 1000,
  cleanupIntervalMs:      30 * 1000,
};

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Build the full ICE server list for WebRTC.
 * Always includes Google STUN servers.
 * If TURN_SERVER, TURN_USERNAME, and TURN_PASSWORD are set in environment,
 * TURN servers are added (UDP + TCP fallback) for NAT traversal on mobile networks.
 */
export function getIceServers(): IceServer[] {
  const servers: IceServer[] = config.stunServers.map((url: string) => ({ urls: url }));

  if (config.turnServer && config.turnUsername && config.turnPassword) {
    // UDP TURN (preferred — lower latency)
    servers.push({
      urls: `turn:${config.turnServer}`,
      username: config.turnUsername,
      credential: config.turnPassword,
    });
    // TCP TURN fallback (works through firewalls that block UDP)
    servers.push({
      urls: `turn:${config.turnServer}?transport=tcp`,
      username: config.turnUsername,
      credential: config.turnPassword,
    });
    console.log(`[ICE] TURN server configured: ${config.turnServer}`);
  } else {
    console.warn('[ICE] No TURN server configured — connections may fail on symmetric NAT (mobile networks). Set TURN_SERVER, TURN_USERNAME, TURN_PASSWORD env vars.');
  }

  return servers;
}
