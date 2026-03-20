import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When Docker is running:  AUTH_DEV_URL / MAPS_DEV_URL are unset → proxy through Traefik at localhost:80
// When Docker is NOT running:
//   AUTH_DEV_URL=http://localhost:8002 (make dev-auth)
//   MAPS_DEV_URL=http://localhost:8006  (make dev-maps)
const AUTH_URL = process.env.AUTH_DEV_URL || 'http://localhost'
const MAPS_URL = process.env.MAPS_DEV_URL || 'http://localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/auth': { target: AUTH_URL, changeOrigin: true },
      '/maps': { target: MAPS_URL, changeOrigin: true },
    },
  },
})
