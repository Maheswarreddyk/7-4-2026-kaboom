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
  return [
    {
      urls: "stun:stun.relay.metered.ca:80"
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "75ce0488e2b6dd463873fe19",
      credential: "86h9uzIutQ27P3Mq"
    }
  ];
}
