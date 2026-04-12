import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * ISSUE 8 FIX: Added server.proxy so that API calls to /api/v1/...
 * during `npm run dev` are forwarded to the FastAPI backend on port 8000.
 *
 * Without this, every fetch('/api/v1/students') in the Vite dev server
 * hits localhost:5173/api/... and returns a 404 — the backend is never
 * contacted. nginx.conf handles the same proxy in the production Docker
 * build, but Vite's built-in server needs its own proxy config.
 */
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Proxy all /api requests to the FastAPI backend
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                // Uncomment the line below if you need to strip /api prefix:
                // rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
})
