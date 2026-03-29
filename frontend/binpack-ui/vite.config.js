import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
var AUTH_URL = process.env.AUTH_DEV_URL || 'http://localhost';
var BINPACK_URL = process.env.BINPACK_DEV_URL || 'http://localhost';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
        port: 5175,
        proxy: {
            '/auth': { target: AUTH_URL, changeOrigin: true },
            '/binpack': {
                target: BINPACK_URL,
                changeOrigin: true,
                bypass: function (req) {
                    var _a, _b;
                    if ((_b = (_a = req.headers) === null || _a === void 0 ? void 0 : _a.accept) === null || _b === void 0 ? void 0 : _b.includes('text/html'))
                        return '/index.html';
                },
            },
        },
    },
});
