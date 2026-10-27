import { defineConfig } from 'vite';
import scansApiHandler from './api/scans.js';
import receiptScanHandler from './api/receipt-scan.js';
import tripsApiHandler from './api/trips.js';
import foodWasteApiHandler from './api/food-waste.js';
import recipeInteractionsHandler from './api/recipe-interactions.js';

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
          const url = new URL(req.url, 'http://localhost');

          // Intercept /api/recipe-interactions route
          if (url.pathname === '/api/recipe-interactions') {
            try {
              await recipeInteractionsHandler(req, res);
            } catch (err) {
              console.error('[Vite Recipe Interactions API Error]:', err);
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

          // Intercept /api/receipt-scan route
          if (url.pathname === '/api/receipt-scan') {
            try {
              await receiptScanHandler(req, res);
            } catch (err) {
              console.error('[Vite Receipt Scan API Error]:', err);
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

          // Intercept /api/trips route
          if (url.pathname === '/api/trips') {
            try {
              await tripsApiHandler(req, res);
            } catch (err) {
              console.error('[Vite Trips API Error]:', err);
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

          // Intercept /api/food-waste route
          if (url.pathname === '/api/food-waste') {
            try {
              await foodWasteApiHandler(req, res);
            } catch (err) {
              console.error('[Vite Food Waste API Error]:', err);
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

          // Intercept /api/scans and /api/history routes
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
