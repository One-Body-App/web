import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Bind localhost so the HMR websocket client targets the same origin the
    // browser loaded from (avoids a reconnect/reload loop behind the preview).
    host: 'localhost',
    strictPort: true,
  },
  build: {
    // Map providers are isolated behind dynamic imports; the largest provider
    // chunk is expected and is not part of the initial app load.
    chunkSizeWarningLimit: 1900,
  },
});
