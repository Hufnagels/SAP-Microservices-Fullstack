import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const AUTH_URL  = process.env.AUTH_DEV_URL  || 'http://localhost'
const OPCUA_URL = process.env.OPCUA_DEV_URL || 'http://localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    proxy: {
      '/auth':  { target: AUTH_URL,  changeOrigin: true },
      '/opcua': { target: OPCUA_URL, changeOrigin: true },
    },
  },
})
