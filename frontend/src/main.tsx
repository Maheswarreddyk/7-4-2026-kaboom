import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './index.css';
import { cleanupSession, resetToCleanState } from './utils/cleanup.js';
import { safeLocalStorage } from './utils/safeStorage.js';
import { STORAGE_KEYS } from './types/index.js';

// ==========================================
// IMMEDIATE SESSION CLEANUP DIRECTIVE
// ==========================================

const BACKGROUND_GRACE_MS = 60_000; // 60 seconds
const INACTIVITY_THRESHOLD_MS = 5 * 60_000; // 5 minutes
let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    safeLocalStorage.setItem('kaboom_hidden_at', Date.now().toString());
    
    backgroundTimer = setTimeout(async () => {
      await cleanupSession('BACKGROUND_TIMEOUT');
    }, BACKGROUND_GRACE_MS);
  } else {
    if (backgroundTimer !== null) {
      clearTimeout(backgroundTimer);
      backgroundTimer = null;
    }
    
    const hiddenAtStr = safeLocalStorage.getItem('kaboom_hidden_at');
    const hiddenAt = parseInt(hiddenAtStr || '0', 10);
    safeLocalStorage.removeItem('kaboom_hidden_at');
    
    if (hiddenAt > 0 && Date.now() - hiddenAt > INACTIVITY_THRESHOLD_MS) {
      // User has been gone for more than 5 minutes.
      // We preserve filters but clear the session so they are routed to the landing page.
      resetToCleanState('INACTIVITY_RETURN', true);
      // Force a full reload to reset all React state and hit the landing page
      window.location.href = '/';
    }
  }
});

const handlePageExit = () => {
  const sessionId = safeLocalStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (sessionId) {
    // SendBeacon is the only API guaranteed to fire after page closes
    navigator.sendBeacon(
      '/api/session/cleanup', 
      JSON.stringify({ sessionId, reason: 'PAGE_UNLOAD' })
    );
  }
  // Clear local state immediately, preserving filters just in case they reopen later
  resetToCleanState('PAGE_UNLOAD', true);
};

window.addEventListener('pagehide', handlePageExit);
window.addEventListener('beforeunload', handlePageExit);

// ==========================================
// P0 Safari/iOS Fix
// ==========================================
// iOS Safari debug console overlay. We still handle errors via the ErrorBoundary.
window.addEventListener('unhandledrejection', (event) => {
  // Swallow WebRTC-related promise rejections that happen on iOS Safari
  // (e.g., getUserMedia blocked, play() autoplay blocked, ICE failures)
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? '');
  if (
    msg.includes('play()') ||
    msg.includes('getUserMedia') ||
    msg.includes('RTCPeer') ||
    msg.includes('setRemoteDescription') ||
    msg.includes('setLocalDescription') ||
    msg.includes('NotAllowedError') ||
    msg.includes('AbortError') ||
    msg.includes('interrupted')
  ) {
    event.preventDefault();
  }
});

const isDev = import.meta.env.DEV;

createRoot(document.getElementById('root')!).render(
  isDev ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  )
);
