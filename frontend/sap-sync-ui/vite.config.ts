import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const AUTH_URL = process.env.AUTH_DEV_URL || 'http://localhost'
const SAP_URL  = process.env.SAP_DEV_URL  || 'http://localhost'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: AUTH_URL, changeOrigin: true },
      '/sap':  { target: SAP_URL,  changeOrigin: true },
    },
  },
})
