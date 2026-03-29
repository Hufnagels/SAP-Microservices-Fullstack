import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const AUTH_URL    = process.env.AUTH_DEV_URL    || 'http://localhost'
const BINPACK_URL = process.env.BINPACK_DEV_URL || 'http://localhost'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5175,
    proxy: {
      '/auth':    { target: AUTH_URL,    changeOrigin: true },
      '/binpack': {
        target: BINPACK_URL,
        changeOrigin: true,
        bypass: (req: { headers: { accept?: string } }) => {
          if (req.headers?.accept?.includes('text/html')) return '/index.html';
        },
      },
    },
  },
})
