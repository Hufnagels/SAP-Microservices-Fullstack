import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
const GATEWAY = 'http://localhost'

const apiProxy = {
  target: GATEWAY,
  changeOrigin: true,
}

// For routes shared between React Router and the API (e.g. /maps/*), we only
// proxy XHR/fetch requests. Browser navigations carry "text/html" in Accept,
// so we fall through to index.html and let React Router handle them.
const apiProxyWithBypass = {
  ...apiProxy,
  bypass(req: any) {
    if (req.headers.accept?.includes('text/html')) return '/index.html';
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5176,
    proxy: {
      '/auth':      apiProxy,
      '/files':     apiProxyWithBypass,
      '/sap':       apiProxyWithBypass,
      '/binpack':   apiProxyWithBypass,
      '/labeling':  apiProxyWithBypass,
      '/maps':      apiProxyWithBypass,
      '/orders':    apiProxyWithBypass,
      '/inventory': apiProxyWithBypass,
      '/reporting': apiProxyWithBypass,
      '/sensor':    apiProxyWithBypass,
    },
  },
})
