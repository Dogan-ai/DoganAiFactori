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
    winston.format.json()
  ),
  transports: loggerTransports
});

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "wss:", "ws:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Arabic RTL support headers
  res.setHeader('Content-Language', 'ar');
  res.setHeader('X-UA-Compatible', 'IE=edge');
  
  next();
});

app.use(compression());
// Enhanced CORS configuration for production
const rawCors = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || process.env.CORS_ALLOWED_ORIGINS;
const defaultOrigins = [
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:80',
  'http://localhost:5173',
  'https://dogan-ai-frontend-app.azurewebsites.net',
  'https://agent-factory-frontend-final.azurewebsites.net',
  'https://www.dogan-ai.com',
  'https://dogan-ai.com',
  'https://frontend-fyp73tc7b-dogan-consult.vercel.app',
  'https://frontend-jjz3wwwu8d-dogan-consult.vercel.app',
  'https://frontend-dogan-consult.vercel.app'
];
const allowedOrigins = rawCors ? rawCors.split(',').map(s => s.trim()).filter(Boolean) : defaultOrigins;

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
// JSON parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Sales Agent Routes
app.use('/api/sales-agent', salesAgentRoutes);

// Authentication Routes
console.log('Mounting auth routes...');
app.use('/api/auth', authRoutes);
console.log('Auth routes mounted successfully');

// Quality Assurance Routes
app.use('/api/quality-assurance', qualityAssuranceRoutes);

// Chat and related endpoints consumed by the frontend
app.use('/api/chat', chatRoutes);

// Subscription Routes
app.use('/api/subscriptions', subscriptionRoutes);

// Agents management routes
app.use('/api', agentsRoutes);

// Environment variables
const {
  OPENAI_API_KEY,
  FACTORY_TOKEN,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  JWT_SECRET = 'default-secret'
} = process.env;

// Agent configurations
const AGENT_CONFIGS = {
  'المحاسب الذكي': {
    systemPrompt: `أنت مساعد محاسبي للشركات في السعودية. هدفك: تجهيز فواتير متوافقة مع متطلبات زاتكا، تلخيص مصروفات، توليد قيود يومية مبسطة، اقتراح تقارير شهرية. لا تقدّم استشارات قانونية أو ضريبية ملزمة. عند نقص بيانات، اسأل أسئلة محددة ومختصرة. اذكر افتراضاتك بوضوح. أعد المخرجات بجداول نظيفة (Markdown) وعناوين عربية/إنجليزية.`,
    tools: ['calculator', 'spreadsheet', 'web_search'],
    maxTokens: 800
  },
  'السكرتير الرقمي': {
    systemPrompt: `أنت سكرتير تنفيذي ثنائي اللغة. هدفك: جدولة المواعيد، صياغة رسائل بريد احترافية، ملخصات للاجتماعات. التزم بالاختصار، مقترحات 3 صيغ لكل رسالة، واطلب التأكيد قبل الإرسال. استخدم نبرة احترافية ومهذبة.`,
    tools: ['calendar', 'email', 'document'],
    maxTokens: 600
  },
  'المبرمج المساعد': {
    systemPrompt: `أنت مساعد برمجة عملي. أنتج حلولاً قصيرة، ثم اختبر عقلياً مدخلات/مخرجات الدالة، وقدّم حالة اختبار. لا تستخدم مكتبات ضخمة دون سبب. عندما يطلب المستخدم "تعليم"، اعرض الخطوات ومخاطر الأمان. التزم بأفضل الممارسات الأمنية.`,
    tools: ['code_execution', 'documentation', 'debugging'],
    maxTokens: 1000
  }
};

// Validation middleware
const validateChatRequest = [
  body('message').notEmpty().withMessage('الرسالة مطلوبة'),
  body('agent').isIn(Object.keys(AGENT_CONFIGS)).withMessage('نوع الوكيل غير صحيح'),
  body('level').notEmpty().withMessage('مستوى الخدمة غير صحيح'),
  body('sessionId').optional().isUUID().withMessage('معرف الجلسة غير صحيح')
];

// Health check endpoint
app.get('/health', async (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      openai: !!OPENAI_API_KEY,
      supabase: !!SUPABASE_URL
    }
  });
});

// Chat endpoint - DISABLED (using routes/chat.js instead)
/*
app.post('/api/chat', validateChatRequest, async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'بيانات الطلب غير صحيحة',
        details: errors.array()
      });
    }

    const { message, agent, level, sessionId = uuidv4(), userId } = req.body;
    
    // Get agent and level configurations
    const agentConfig = AGENT_CONFIGS[agent];
    
    if (!agentConfig) {
      return res.status(400).json({ error: 'تكوين الوكيل غير موجود' });
    }

    // Prepare OpenAI request
    const openaiRequest = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${agentConfig.systemPrompt}\n\nالمزايا المتاحة: ${agentConfig.tools.join(', ')}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: agentConfig.maxTokens,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    };

    let reply = 'عذراً، لم أتمكن من توليد رد مناسب.';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // Try OpenAI API only if explicit flag or clearly valid key
    const isOpenAiConfigured = OPENAI_API_KEY && /^sk-[a-zA-Z0-9]{20,}$/.test(OPENAI_API_KEY);
    if (isOpenAiConfigured) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(openaiRequest)
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          reply = openaiData.choices[0]?.message?.content || reply;
          usage = {
            promptTokens: openaiData.usage?.prompt_tokens || 0,
            completionTokens: openaiData.usage?.completion_tokens || 0,
            totalTokens: openaiData.usage?.total_tokens || 0
          };
        } else {
          // Fall through to fallback
        }
      } catch (error) {
        // Fall through to fallback
      }
    }

    // Fallback response if OpenAI is not available
    if (reply === 'عذراً، لم أتمكن من توليد رد مناسب.') {
      const fallbackResponses = {
        'المحاسب الذكي': `مرحباً! أنا المحاسب الذكي، مساعدك المتخصص في الشؤون المالية والمحاسبية.\n\nيمكنني مساعدتك في:\n• إنشاء فواتير متوافقة مع زاتكا\n• إعداد التقارير المالية والقيود اليومية\n• تحليل المصروفات والإيرادات\n• حساب الضرائب والزكاة\n\nكيف يمكنني مساعدتك اليوم؟`,
        'السكرتير الرقمي': `أهلاً وسهلاً! أنا السكرتير الرقمي، مساعدك الإداري الذكي.\n\nأستطيع مساعدتك في:\n• جدولة المواعيد والاجتماعات\n• صياغة الرسائل الاحترافية\n• إعداد محاضر الاجتماعات\n• تنظيم المهام والمتابعات\n\nما المهمة التي تحتاج مساعدة فيها؟`,
        'المبرمج المساعد': `مرحباً بك! أنا المبرمج المساعد، خبيرك في البرمجة والحلول التقنية.\n\nيمكنني مساعدتك في:\n• كتابة ومراجعة الكود\n• حل المشاكل البرمجية\n• تصميم قواعد البيانات\n• أفضل الممارسات الأمنية\n\nما التحدي البرمجي الذي تواجهه؟`
      };
      
      reply = fallbackResponses[agent] || `مرحباً! أنا ${agent}، مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟`;
    }

    // Log conversation (in production, save to database)
    logger.info('Chat interaction', {
      sessionId,
      userId,
      agent,
      messageLength: message.length,
      replyLength: reply.length,
      timestamp: new Date().toISOString()
    });

    // Return response
    res.json({
      success: true,
      reply,
      sessionId,
      agent,
      timestamp: new Date().toISOString(),
      usage
    });

  } catch (error) {
    logger.error('Chat endpoint error:', error);
    res.status(500).json({ 
      error: 'حدث خطأ داخلي في الخادم',
      code: 'INTERNAL_ERROR'
    });
  }
});
*/

// Main health endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await databaseManager.healthCheck();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        openai: !!OPENAI_API_KEY,
        supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        database: dbHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Database health endpoint for detailed diagnostics
app.get('/api/database/health', async (req, res) => {
  try {
    const health = await databaseManager.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(503).json({
      healthy: false,
      error: error.message,
      type: 'unknown'
    });
  }
});

// Agent information endpoint
app.get('/api/agents', (req, res) => {
  const agents = Object.keys(AGENT_CONFIGS).map(agentName => ({
    name: agentName,
    description: AGENT_CONFIGS[agentName].systemPrompt.substring(0, 200) + '...',
    tools: AGENT_CONFIGS[agentName].tools
  }));

  res.json({ agents });
});

// Pricing endpoint
app.get('/api/pricing', (req, res) => {
  const pricing = {
    currency: 'SAR',
    levels: {
      'جيش جونسون': {
        price: 29,
        features: { messageQuota: 100 }
      },
      'سينيور إكسبرت': {
        price: 199,
        features: { messageQuota: 2000 }
      },
      'شيف إكسبرت': {
        price: 399,
        features: { messageQuota: 999999 }
      }
    }
  };

  res.json(pricing);
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { 
    error: err.message, 
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  // Handle JSON parsing errors specifically
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON format',
      message: 'تنسيق JSON غير صحيح في البيانات المرسلة'
    });
  }

  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Agent Factory Proxy Server running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🤖 OpenAI API: ${OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
});

export default app;
