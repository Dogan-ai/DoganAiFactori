import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN
  ].filter(Boolean),
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
if (process.env.ENABLE_RATE_LIMIT !== 'false') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use(limiter);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    openai: !!openai
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, agent = 'المحاسب الذكي' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!openai) {
      // Fallback response when OpenAI is not available
      return res.json({
        response: `مرحباً! أنا ${agent}. للأسف، لا يمكنني الوصول إلى خدمة الذكاء الاصطناعي حالياً. يرجى التأكد من إعداد مفتاح OpenAI API بشكل صحيح.`,
        agent,
        timestamp: new Date().toISOString()
      });
    }

    const systemPrompt = `أنت ${agent}، مساعد ذكي متخصص في الأعمال والمحاسبة. 
    قدم إجابات مفيدة ودقيقة باللغة العربية.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content || 'عذراً، لم أتمكن من معالجة طلبك.';

    res.json({
      response,
      agent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Chat error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'حدث خطأ أثناء معالجة طلبك'
    });
  }
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Simple mock registration
    const user = {
      id: uuidv4(),
      email,
      name,
      createdAt: new Date().toISOString()
    };

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'User registered successfully',
      user,
      token
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Simple mock login
    const user = {
      id: uuidv4(),
      email,
      name: 'Test User'
    };

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user,
      token
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Subscription endpoints
app.get('/api/subscription/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'basic',
        name: 'الخطة الأساسية',
        price: 99,
        currency: 'SAR',
        features: ['دردشة مع الوكلاء الذكيين', 'تقارير أساسية', 'دعم فني']
      },
      {
        id: 'premium',
        name: 'الخطة المتقدمة',
        price: 299,
        currency: 'SAR',
        features: ['جميع ميزات الخطة الأساسية', 'تحليلات متقدمة', 'تكامل مع الأنظمة الخارجية']
      }
    ]
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Serve frontend for non-API routes
app.get('*', (req, res) => {
  // If it's an API route, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`
    });
  }
  
  // Serve the main HTML file
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Dogan AI Factory Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`OpenAI enabled: ${!!openai}`);
});

export default app;