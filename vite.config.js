import { defineConfig } from 'vite';
import scansApiHandler from './api/scans.js';

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  plugins: [
    {
      name: 'neon-scans-api-dev-server',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Intercept /api/scans and /api/history routes
          const url = new URL(req.url, 'http://localhost');
          if (url.pathname === '/api/scans' || url.pathname === '/api/history') {
            try {
              await scansApiHandler(req, res);
            } catch (err) {
              console.error('[Vite Dev API Server Error]:', err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  error: 'INTERNAL_SERVER_ERROR',
                  message: err.message
                }));
              }
            }
            return;
          }
          next();
        });
      }
    }
  ]
});
