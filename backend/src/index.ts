import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import fs from 'fs';

import { config } from './config/index.js';
import { initDatabase } from './database/index.js';
import { initWebSocketServer } from './services/websocket.js';
import { Logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Import Routes
import authRoutes from './routes/auth.js';
import serverRoutes from './routes/server.js';
import backupRoutes from './routes/backup.js';
import restoreRoutes from './routes/restore.js';
import configRoutes from './routes/config.js';
import playerRoutes from './routes/players.js';
import consoleRoutes from './routes/console.js';
import fileRoutes from './routes/files.js';
import monitoringRoutes from './routes/monitoring.js';
import gdriveRoutes from './routes/gdrive.js';

// Import Services to initialize background workers
import { MonitoringService } from './modules/monitoring/monitoringService.js';
import { ConsoleService } from './modules/console/consoleService.js';
import { SchedulerService } from './modules/scheduler/schedulerService.js';

const app = express();
const server = http.createServer(app);

// Initialize Database
initDatabase();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow inline styles and SPA script loading
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiter to /api
app.use('/api', apiLimiter);

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/server', serverRoutes);
app.use('/api/v1/backup', backupRoutes);
app.use('/api/v1/restore', restoreRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/console', consoleRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/gdrive', gdriveRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'PalAutoBC', timestamp: new Date().toISOString() });
});

// Serve Frontend Static Assets
if (fs.existsSync(config.publicDir)) {
  app.use(
    express.static(config.publicDir, {
      maxAge: '1d',
      etag: true,
    })
  );

  // SPA Fallback for client-side routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>PalAutoBC API</title></head>
        <body style="background:#09090B;color:#FAFAFA;font-family:sans-serif;padding:2rem;">
          <h1>PalAutoBC Backend Active</h1>
          <p>Frontend production assets not yet built into public/. Run <code>npm run build</code> in the frontend folder.</p>
          <p>API Endpoint: <a href="/api/health" style="color:#A3E635;">/api/health</a></p>
        </body>
      </html>
    `);
  });
}

// Global Error Handler
app.use(errorHandler);

// Initialize WebSocket Server on same port 3000
initWebSocketServer(server);

// Initialize Background Workers
MonitoringService.init();
ConsoleService.init();
SchedulerService.init();

// Start Server
server.listen(config.port, config.host, () => {
  Logger.info(`=======================================================`);
  Logger.info(`  PalAutoBC — Dedicated Palworld Server Dashboard    `);
  Logger.info(`  Unified Server Running on http://${config.host}:${config.port}`);
  Logger.info(`  Palworld Game Port: ${config.palworldPort}                     `);
  Logger.info(`  WebSocket Endpoint: ws://${config.host}:${config.port}/ws       `);
  Logger.info(`=======================================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  Logger.info('[Server] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    Logger.info('[Server] HTTP and WebSocket servers closed.');
    process.exit(0);
  });
});

