import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api to Django. The browser therefore only ever talks
// to localhost:5173 -- no cross-origin request is made, so no CORS headers are
// needed and django-cors-headers stays uninstalled. This is a dev-only trick:
// in production, whatever serves the built files has to either serve /api from
// the same origin too, or Django has to start sending real CORS headers.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // `localhost`, not 127.0.0.1: changeOrigin rewrites the Host header to
        // match the target, and settings.ALLOWED_HOSTS is ['localhost'].
        // A non-empty ALLOWED_HOSTS gets no debug-mode additions, so
        // 127.0.0.1 would come back as a 400 DisallowedHost on every call.
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
