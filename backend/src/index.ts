import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { config } from './config/index.js';
import { checkDatabaseConnection, getSupabase } from './database/client.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import analyticsRouter from './analytics/routes.js';

import { cleanupService, statsService } from './services/index.js';

import { runGlobalMatchCycle } from './matchmaking/matchingEngine.js';
import { MatchScheduler } from './matchmaking/MatchScheduler.js';
import { CampaignManager } from './notifications/CampaignManager.js';

// Initialize Web Push VAPID keys
CampaignManager.init();
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*')) return true;
  
  // Allow localhost only in non-production environments
  if (config.nodeEnv !== 'production') {
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  }
  
  // Allow custom domain and its subdomains
  if (/^https?:\/\/(.*\.)?kaboom-tv\.com$/.test(origin)) return true;
  
  // Allow our specific Render service URL
  if (origin === 'https://seven-4-2026-kaboom-1a.onrender.com') return true;
  
  return false;
};



app.set('trust proxy', 1);

// Add Permissions-Policy header middleware
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), interest-cohort=()'
  );
  next();
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        config.supabaseUrl,
        config.supabaseUrl.replace('https://', 'wss://'),
        "https://*.supabase.co",
        "wss://*.supabase.co",
        "https://*.kaboom-tv.com",
        "wss://*.kaboom-tv.com",
        "https://seven-4-2026-kaboom-1a.onrender.com",
        "wss://seven-4-2026-kaboom-1a.onrender.com"
      ],
      mediaSrc: ["'self'", "blob:", "mediastream:"],
      imgSrc: ["'self'", "data:", config.supabaseUrl, "https://*.supabase.co"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    }
  }
}));

app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, origin);
    } else {
      console.warn(`[Express CORS Blocked] Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Robust request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const sessionId = req.body?.sessionId || req.query?.sessionId || req.headers['x-session-id'] || 'N/A';
  const matchId = req.body?.matchId || req.query?.matchId || 'N/A';
  
  console.log(`[Request] [${timestamp}] Method: ${req.method} | Path: ${req.path} | SessionId: ${sessionId} | MatchId: ${matchId}`);
  
  next();
});

app.use('/api', routes);
app.use('/api/analytics', analyticsRouter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../dist');

// Serve static assets from frontend build if it exists
app.use(express.static(distPath));

// For SPA routes, fallback to index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use(notFoundHandler);
app.use(globalErrorHandler);



let metricsInterval: ReturnType<typeof setInterval> | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

async function startServer(): Promise<void> {
  const dbConnected = await checkDatabaseConnection();

  if (!dbConnected) {
    console.warn('[Warning] Database connection failed. Ensure Supabase credentials are configured.');
    console.warn('[Warning] API will start but database operations may fail.');
  } else {
    console.log('[Database] Connected to Supabase');
  }

  server.listen(config.port, () => {
    console.log(`[Server] IndiaTV backend running on port ${config.port}`);
    console.log(`[Server] Frontend URL: ${config.frontendUrl}`);
    console.log(`[Server] Environment: ${config.nodeEnv}`);
  });

  metricsInterval = setInterval(async () => {
    try {
      await statsService.recordMetrics(matchingEngine.getOnlineCount());
    } catch (error) {
      console.error('[Metrics] Failed to record:', error);
    }
  }, config.metricsIntervalMs);

  cleanupInterval = setInterval(async () => {
    try {
      await cleanupService.runCleanup(config.queueStaleMs, config.matchStaleMs);
    } catch (error) {
      console.error('[Cleanup] Failed:', error);
    }
  }, config.cleanupIntervalMs);

  if (dbConnected) {
    MatchScheduler.start();
  }
}

function gracefulShutdown(signal: string): void {
  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);

  MatchScheduler.stop();
  if (metricsInterval) clearInterval(metricsInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);

  io.close(() => {
    server.close(() => {
      console.log('[Server] Shutdown complete');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});

export { app, server, io };
