import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When Docker is running:  AUTH_DEV_URL / SAP_DEV_URL are unset → proxy through Traefik at localhost:80
// When Docker is NOT running:
//   AUTH_DEV_URL=http://localhost:8002 (make dev-auth)
//   SAP_DEV_URL=http://localhost:8003  (make dev-sap)
const AUTH_URL = process.env.AUTH_DEV_URL || 'http://localhost'
const SAP_URL  = process.env.SAP_DEV_URL  || 'http://localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: AUTH_URL, changeOrigin: true },
      '/sap':  { target: SAP_URL,  changeOrigin: true },
    },
  },
})
