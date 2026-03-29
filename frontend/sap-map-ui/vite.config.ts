import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const AUTH_URL = process.env.AUTH_DEV_URL || 'http://localhost'
const MAPS_URL = process.env.MAPS_DEV_URL || 'http://localhost'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5174,
    proxy: {
      '/auth': { target: AUTH_URL, changeOrigin: true },
      '/maps': { target: MAPS_URL, changeOrigin: true },
    },
  },
})
