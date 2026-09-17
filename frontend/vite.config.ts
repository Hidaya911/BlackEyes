import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        configure(proxy) {
          proxy.on('error', (_error, request, response) => {
            if (!('writeHead' in response) || response.headersSent || response.destroyed) return;
            response.writeHead(503, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
              detail: request.method === 'GET'
                ? 'The backend is unavailable or restarting. Wait a moment and refresh. If this continues, start backend/run.py.'
                : 'The backend connection was interrupted. Check whether your changes were saved before trying again.',
            }));
          });
        },
      },
    },
  },
})
