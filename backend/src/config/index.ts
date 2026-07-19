import { environment } from 'config';
import crypto from 'crypto';

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
  cleanupIntervalMs:      5 * 1000, // 5s for fast 10s heartbeat cleanup
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

  if (config.turnServer || config.turnPassword) {
    const turnHost = config.turnServer || 'global.relay.metered.ca';
    const turnSecret = config.turnPassword || 'QAWBn93cIDtErz8U'; 
    const ttlSeconds = 86400; // 24 hours
    const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${timestamp}:${config.turnUsername || 'kaboom'}`;
    const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');

    servers.push(
      { urls: `stun:stun.relay.metered.ca:80` },
      { urls: `turn:${turnHost}:80`, username, credential },
      { urls: `turn:${turnHost}:80?transport=tcp`, username, credential },
      { urls: `turn:${turnHost}:443`, username, credential },
      { urls: `turns:${turnHost}:443?transport=tcp`, username, credential }
    );
  } else {
    console.warn('[ICE] No TURN server configured — connections may fail on symmetric NAT (mobile networks). Set TURN_SERVER, TURN_USERNAME, TURN_PASSWORD env vars.');
  }

  return servers;
}
