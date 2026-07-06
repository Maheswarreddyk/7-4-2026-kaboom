// Centralized deployment configuration module

const isBackend = typeof process !== 'undefined' && process.env;

// Helper to access Vite environment variables safely without compiler errors in Node.js
const getViteEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  return undefined;
};

export const environment = {
  appName: isBackend ? (process.env.APP_NAME || 'Kaboom TV') : (getViteEnv('VITE_APP_NAME') || 'Kaboom TV'),
  appUrl: isBackend ? (process.env.APP_URL || 'https://kaboom-tv.com') : (getViteEnv('VITE_APP_URL') || 'https://kaboom-tv.com'),
  apiUrl: isBackend ? (process.env.API_URL || 'https://api.kaboom-tv.com') : (getViteEnv('VITE_API_URL') || 'https://api.kaboom-tv.com'),
  wsUrl: isBackend ? (process.env.WS_URL || 'https://api.kaboom-tv.com') : (getViteEnv('VITE_WS_URL') || 'https://api.kaboom-tv.com'),
  signalingProvider: isBackend ? (process.env.SIGNALING_PROVIDER || 'supabase') : (getViteEnv('VITE_SIGNALING_PROVIDER') || 'supabase'),
  nodeEnv: isBackend ? (process.env.NODE_ENV || 'production') : (getViteEnv('VITE_NODE_ENV') || 'production'),
  
  supabase: {
    url: isBackend ? (process.env.SUPABASE_URL || 'https://dirocenpssdilkztizps.supabase.co') : (getViteEnv('VITE_SUPABASE_URL') || 'https://dirocenpssdilkztizps.supabase.co'),
    anonKey: isBackend ? (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcm9jZW5wc3NkaWxrenRpenBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTY1MzUsImV4cCI6MjA5ODMzMjUzNX0.P1NX8cfS4rTafIINUONBrWH3wI4DaUYrQJJUCJXvU9Y') : (getViteEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcm9jZW5wc3NkaWxrenRpenBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTY1MzUsImV4cCI6MjA5ODMzMjUzNX0.P1NX8cfS4rTafIINUONBrWH3wI4DaUYrQJJUCJXvU9Y'),
    serviceRoleKey: isBackend ? (process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcm9jZW5wc3NkaWxrenRpenBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc1NjUzNSwiZXhwIjoyMDk4MzMyNTM1fQ.aBefMcx8RACTKBTOTuqweuDRT7X284Unfv4xbEFa5NE') : '',
  },
  
  backend: {
    port: isBackend ? parseInt(process.env.PORT || '5000', 10) : 5000,
    frontendUrl: isBackend ? (process.env.FRONTEND_URL || 'https://kaboom-tv.com') : 'https://kaboom-tv.com',
    apiBase: isBackend ? (process.env.API_BASE || '/api') : '/api',
    sessionTimeout: isBackend ? parseInt(process.env.SESSION_TIMEOUT || '1800', 10) : 1800,
    queueTimeout: isBackend ? parseInt(process.env.QUEUE_TIMEOUT || '300', 10) : 300,
    matchTimeout: isBackend ? parseInt(process.env.MATCH_TIMEOUT || '1800', 10) : 1800,
    allowedOrigins: (isBackend ? (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5000,http://localhost:10000,https://indiatv-pnyg.onrender.com,https://indiatv-j905.onrender.com,https://kaboom-tv.com,https://api.kaboom-tv.com') : '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  
  webrtc: {
    stunServers: (isBackend ? (process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302') : (getViteEnv('VITE_STUN_SERVERS') || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302'))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    turnServer: isBackend ? (process.env.TURN_SERVER || '') : (getViteEnv('VITE_TURN_SERVER') || ''),
    turnUsername: isBackend ? (process.env.TURN_USERNAME || '') : (getViteEnv('VITE_TURN_USERNAME') || ''),
    turnPassword: isBackend ? (process.env.TURN_PASSWORD || '') : (getViteEnv('VITE_TURN_PASSWORD') || ''),
  },
  
  admin: {
    adminToken: isBackend ? (process.env.ADMIN_TOKEN || '') : '',
    jwtSecret: isBackend ? (process.env.JWT_SECRET || '') : '',
  },
  
  domain: {
    rootDomain: 'kaboom-tv.com',
    apiSubdomain: 'api.kaboom-tv.com',
    adminSubdomain: 'admin.kaboom-tv.com',
  },
  
  email: {
    contactEmail: 'contact@kaboom-tv.com',
    collaborateEmail: 'collaborate@kaboom-tv.com',
  },

  matchmaking: {
    weights: {
      mutualPreference: isBackend ? Number(process.env.WEIGHT_MUTUAL_PREFERENCE || 50) : 50,
      languagePerMatch: isBackend ? Number(process.env.WEIGHT_LANGUAGE_PER_MATCH || 20) : 20,
      languageMax: isBackend ? Number(process.env.WEIGHT_LANGUAGE_MAX || 40) : 40,
      city: isBackend ? Number(process.env.WEIGHT_CITY || 40) : 40,
      district: isBackend ? Number(process.env.WEIGHT_DISTRICT || 35) : 35,
      state: isBackend ? Number(process.env.WEIGHT_STATE || 30) : 30,
      country: isBackend ? Number(process.env.WEIGHT_COUNTRY || 20) : 20,
      interestPerMatch: isBackend ? Number(process.env.WEIGHT_INTEREST_PER_MATCH || 5) : 5,
      interestMax: isBackend ? Number(process.env.WEIGHT_INTEREST_MAX || 40) : 40,
      waitingPerSecond: isBackend ? Number(process.env.WEIGHT_WAITING_PER_SECOND || 1) : 1,
      waitingMax: isBackend ? Number(process.env.WEIGHT_WAITING_MAX || 60) : 60,
      recentPartnerPenalty: isBackend ? Number(process.env.WEIGHT_RECENT_PARTNER_PENALTY || 100) : 100,
    }
  }
};
