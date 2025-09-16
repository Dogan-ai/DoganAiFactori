# 🤖 Dogan AI Factory

AI-powered business automation platform with intelligent agents specialized for Saudi Arabian businesses.

## 🚀 Features

- **Smart AI Agents**: Specialized agents for accounting, sales, and business operations
- **Arabic Language Support**: Full Arabic language support with cultural context
- **ZATCA Compliance**: Built-in compliance with Saudi tax authority requirements
- **Real-time Chat**: Interactive chat interface with AI agents
- **Subscription Management**: Flexible subscription plans
- **Secure Authentication**: JWT-based authentication system

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **AI**: OpenAI GPT-3.5/GPT-4
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Authentication**: JWT

## 🔧 Environment Variables

```env
NODE_ENV=production
OPENAI_API_KEY=your-openai-api-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
FACTORY_TOKEN=your-factory-token
ENABLE_OPENAI=true
ENABLE_CACHE=true
ENABLE_RATE_LIMIT=true
ENABLE_AUDIT_LOG=true
FRONTEND_URL=your-frontend-url
API_URL=your-api-url
CORS_ORIGIN=your-cors-origin
```

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/dogan-ai-factory.git
   cd dogan-ai-factory
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Start the server**
   ```bash
   npm start
   ```

### Deploy to Vercel

1. **Push to GitHub**
2. **Connect to Vercel**
3. **Add environment variables**
4. **Deploy**

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Authentication
```
POST /api/auth/register
POST /api/auth/login
```

### Chat
```
POST /api/chat
```

### Subscriptions
```
GET /api/subscription/plans
```

## 🤖 Available AI Agents

- **المحاسب الذكي** (Smart Accountant): Specialized in Saudi accounting and ZATCA compliance
- **مندوب المبيعات** (Sales Agent): Expert in sales processes and customer relations
- **مراقب الجودة** (Quality Assurance): Ensures service quality and compliance

## 🔒 Security Features

- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- JWT authentication
- Request logging

## 📊 Monitoring

- Winston logging
- Health check endpoints
- Error tracking
- Performance monitoring

## 🌍 Localization

- Full Arabic language support
- Saudi Arabian business context
- Cultural adaptation
- RTL text support

## 📞 Support

For support and questions, please contact our team or create an issue in the repository.

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for Saudi Arabian businesses**