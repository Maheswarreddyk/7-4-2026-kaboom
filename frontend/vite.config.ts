import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_PROXY = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
  '/socket.io': {
    target: 'http://localhost:5000',
    ws: true,
    changeOrigin: true,
  },
};

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: API_PROXY,
  },
  preview: {
    port: 4173,
    proxy: API_PROXY,
  },
  build: {
    // Drop console.log/debug/info in production. Keep console.warn/error for real errors.
    // This is the P0 fix: iPhone/Safari users saw raw debug logs on screen.
    esbuild: mode === 'production' ? {
      drop: ['debugger'],
      pure: ['console.log', 'console.info', 'console.debug'],
    } : {},
    rollupOptions: {
      output: {
        // No manual chunks to avoid circular dependency issues
      }
    }
  }
}));
