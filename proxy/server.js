import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import path from 'path';
import salesAgentRoutes from './routes/sales-agent.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat-ai-simulated.js'; // AI-simulated intelligent responses
import qualityAssuranceRoutes from './routes/quality-assurance.js';
import agentsRoutes from './routes/agents.js';
import subscriptionRoutes from './routes/subscription.js';
import databaseManager from './database-config.js';


dotenv.config();
// Also try to load root-level .env when running from ./proxy
try { dotenv.config({ path: path.resolve(process.cwd(), '../.env') }); } catch {}

const app = express();
const PORT = process.env.PORT || 8080;

// Normalize environment variable names (backwards compatibility)
if (!process.env.RATE_LIMIT_WINDOW && process.env.RATE_LIMIT_WINDOW_MS) {
  process.env.RATE_LIMIT_WINDOW = process.env.RATE_LIMIT_WINDOW_MS;
}

// Logger configuration
// Use console-only by default (serverless-safe). Enable file logs only when explicitly allowed.
const loggerTransports = [new winston.transports.Console()];
const serverlessEnv = process.env.VERCEL || process.env.AZURE_FUNCTIONS_ENVIRONMENT || process.env.AWS_REGION;
if (process.env.ENABLE_FILE_LOGS === 'true' && !serverlessEnv) {
  try {
    loggerTransports.push(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
    loggerTransports.push(new winston.transports.File({ filename: 'logs/combined.log' }));
  } catch (e) {
    // Ignore file logging errors in restricted environments
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: loggerTransports
});

// Initialize database
databaseManager.initialize().catch(err => {
  logger.error('Database initialization failed:', err);
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"]
    }
  }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      process.env.FRONTEND_URL,
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

if (process.env.ENABLE_RATE_LIMIT !== 'false') {
  app.use(limiter);
}

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/sales-agent', salesAgentRoutes);
app.use('/api/quality-assurance', qualityAssuranceRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(process.cwd(), 'frontend', 'dist');
  app.use(express.static(frontendPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

const server = app.listen(PORT, () => {
  logger.info(`🚀 Dogan AI Factory Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`OpenAI enabled: ${process.env.ENABLE_OPENAI === 'true'}`);
});

export default app;