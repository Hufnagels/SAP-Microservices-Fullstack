import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.VITE_BACKEND_URL || 'http://localhost';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    proxy: {
      '/labeling': {
        target: BACKEND,
        changeOrigin: true,
        ...(process.env.VITE_BACKEND_URL
          ? { rewrite: (path: string) => path.replace(/^\/labeling/, '') }
          : {}),
      },
      '/auth': {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
});
