import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const AUTH_URL    = process.env.AUTH_DEV_URL    || 'http://localhost'
const BINPACK_URL = process.env.BINPACK_DEV_URL || 'http://localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/auth':    { target: AUTH_URL,    changeOrigin: true },
      '/binpack': {
        target: BINPACK_URL,
        changeOrigin: true,
        bypass: (req) => {
          if (req.headers?.accept?.includes('text/html')) return '/index.html';
        },
      },
    },
  },
})
