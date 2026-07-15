import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './index.css';

// P0 Safari/iOS Fix: Suppress unhandled promise rejections from leaking to the
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
