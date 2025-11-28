import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { existsSync } from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import routes
import authRoutes from './src/routes/auth';
import dashboardRoutes from './src/routes/dashboard';
import studentRoutes from './src/routes/students';
import attendanceRoutes from './src/routes/attendance';
import deviceRoutes from './src/routes/devices';
import airQualityRoutes from './src/routes/airquality';
import alertRoutes from './src/routes/alerts';
import reportRoutes from './src/routes/reports';
import adminRoutes from './src/routes/admin';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const WS_PORT = process.env.WS_PORT || PORT; // Will share HTTP server port if not explicitly set
const isDevelopment = process.env.NODE_ENV !== 'production';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/airquality', airQualityRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// Proxy to Next.js dev server in development, serve static files in production
if (isDevelopment) {
  const NEXT_DEV_PORT = process.env.NEXT_DEV_PORT || 3000;
  const nextDevServer = `http://localhost:${NEXT_DEV_PORT}`;
  
  console.log(`Setting up proxy to Next.js dev server at ${nextDevServer}`);
  
  // Proxy all non-API requests to Next.js dev server
  const proxyMiddleware = createProxyMiddleware({
    target: nextDevServer,
    changeOrigin: true,
    ws: true, // Proxy websockets for Next.js HMR
  });
  
  // Apply proxy only to non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    return proxyMiddleware(req, res, next);
  });
} else {
  const clientBuildPath = path.join(__dirname, '../Client/.next');
  const clientPublicPath = path.join(__dirname, '../Client/public');
  
  if (existsSync(clientBuildPath)) {
    console.log('Serving Next.js static files from:', clientBuildPath);
    
    // Serve Next.js static files
    app.use('/_next', express.static(path.join(clientBuildPath, 'static')));
    app.use('/public', express.static(clientPublicPath));
    
    // Serve Next.js pages (catch-all for client-side routing)
    app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
      }
      
      // For production, you would use Next.js custom server or export static HTML
      res.sendFile(path.join(clientBuildPath, 'server/pages', req.path + '.html'), (err) => {
        if (err) {
          res.sendFile(path.join(clientBuildPath, 'server/pages/index.html'));
        }
      });
    });
  }
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for ESP32 devices (attach to existing HTTP server; isolate path to avoid clashing with Next.js HMR websockets)
const wss = new WebSocketServer({ server, path: '/ws/devices' });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] New device connected from ${clientIp}`);

  ws.on('message', (message, isBinary) => {
    if (isBinary) {
      // Ignore binary frames from non-IoT clients
      return;
    }
    try {
      const data = JSON.parse(message.toString());
      console.log('[WebSocket] Received:', data);

      // Handle different message types from ESP32
      switch (data.type) {
        case 'attendance':
          // Forward to attendance API
          console.log('[WebSocket] Attendance data:', data);
          break;
        case 'airquality':
          // Forward to air quality API
          console.log('[WebSocket] Air quality data:', data);
          break;
        case 'device_status':
          // Update device status
          console.log('[WebSocket] Device status:', data);
          break;
        default:
          console.log('[WebSocket] Unknown message type:', data.type);
      }

      // Send acknowledgment
      ws.send(JSON.stringify({ status: 'received', timestamp: new Date().toISOString() }));
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error);
      try { ws.send(JSON.stringify({ status: 'error', message: 'Invalid message format' })); } catch {}
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Device disconnected from ${clientIp}`);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
  });

  // Send welcome message
  ws.send(JSON.stringify({ 
    status: 'connected', 
    message: 'Welcome to ClassTrack IoT Server',
    timestamp: new Date().toISOString(),
  }));
});

// Start HTTP server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           ClassTrack Server Started                   ║
╠═══════════════════════════════════════════════════════╣
║  Application:      http://localhost:${PORT}              ║
║  API Endpoint:     http://localhost:${PORT}/api          ║
║  WebSocket:        ws://localhost:${WS_PORT}/ws/devices     ║
║  Environment:      ${process.env.NODE_ENV || 'development'}                       ║
║  Mode:             ${isDevelopment ? 'Development (Proxy)    ' : 'Production (Static)     '} ║
╚═══════════════════════════════════════════════════════╝
  `);
  
  if (isDevelopment) {
    console.log(`
✅ DEVELOPMENT MODE (Single Port):
  - Application proxied from Next.js dev server (port ${process.env.NEXT_DEV_PORT || 3000})
  - Everything accessible at http://localhost:${PORT}
  - API at http://localhost:${PORT}/api
  - WebSocket shares same HTTP port (upgrade) to prevent EACCES issues
  - Hot reload enabled via proxy
   
⚠️  Make sure Next.js dev server is running:
   → npm run dev:client (in another terminal)
   → or use: npm run dev (from root - runs both)
    `);
  } else {
    console.log(`
✅ PRODUCTION MODE:
   - Frontend and Backend unified on port ${PORT}
   - Access application at http://localhost:${PORT}
    `);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
