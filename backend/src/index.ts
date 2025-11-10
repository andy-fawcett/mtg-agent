import express, { Request, Response, NextFunction, Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import { getSessionConfig } from './config/session';

// Load environment variables first
dotenv.config();

// Create Express app
const app: Express = express();
const PORT = process.env.PORT || 3000;

// ======================
// Security Middleware
// ======================
app.use(helmet());

// ======================
// CORS Configuration
// ======================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ======================
// Body Parsing
// ======================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ======================
// Session Management
// ======================
// Session middleware must be added BEFORE routes that need authentication
app.use(session(getSessionConfig()));

// ======================
// Request Logging
// ======================
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ======================
// API Routes
// ======================
import authRoutes from './routes/auth';

app.use('/api/auth', authRoutes);

// ======================
// Health Check Endpoint
// ======================
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// ======================
// Root Endpoint
// ======================
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'MTG Agent API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/docs', // Future
  });
});

// ======================
// 404 Handler
// ======================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// ======================
// Error Handler
// ======================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.SHOW_STACK_TRACES === 'true' ? err.message : 'Something went wrong',
    ...(process.env.SHOW_STACK_TRACES === 'true' && { stack: err.stack }),
  });
});

// ======================
// Start Server
// ======================
const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 MTG Agent API Server');
  console.log('='.repeat(50));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔒 CORS enabled for: ${process.env.FRONTEND_URL}`);
  console.log(`✅ Server ready for requests`);
  console.log('='.repeat(50));
});

// ======================
// Graceful Shutdown
// ======================
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
