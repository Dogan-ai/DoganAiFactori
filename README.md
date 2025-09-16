# 🤖 Dogan AI Factory

A comprehensive AI-powered business automation platform with intelligent agents for accounting, programming, marketing, and administrative tasks.

## 🌟 Features

- **🤖 AI Agents**: Multiple specialized AI assistants (Accountant, Secretary, Programmer, Marketing Consultant)
- **💳 Subscription Management**: Complete subscription lifecycle with real payment processing
- **📱 SMS Integration**: Multi-provider SMS service with OTP verification
- **🔐 Authentication**: Secure user authentication with JWT and session management
- **📊 Real-time Analytics**: Business intelligence and reporting
- **🌍 Multi-language**: Arabic and English support
- **💾 Database Integration**: Supabase integration with real-time capabilities

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/dogan-ai-factory.git
cd dogan-ai-factory
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.production
# Edit .env.production with your actual values
```

4. **Set up database**
```bash
# Run the SQL schema in your Supabase dashboard
# File: database/subscriptions-schema.sql
```

5. **Start the application**
```bash
npm start
```

## 🔧 Configuration

### Required Environment Variables

```env
# OpenAI (Required)
OPENAI_API_KEY=sk-your-openai-api-key

# Supabase (Required)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT Secret (Required)
JWT_SECRET=your-jwt-secret-minimum-32-chars
```

### Optional Services

- **SMS**: Twilio, AWS SNS, or Local SMS Gateway
- **Payments**: Stripe or PayPal
- **Email**: SMTP configuration
- **Monitoring**: Sentry, New Relic

## 📁 Project Structure

```
dogan-ai-factory/
├── proxy/                 # Main server and API routes
│   ├── server.js          # Express server
│   ├── routes/            # API endpoints
│   └── services/          # Business logic
├── services/              # Shared services
│   ├── SubscriptionService.js
│   └── SmsService.js
├── database/              # Database schemas
├── DoganAI-Package/       # AI package components
└── api/                   # Additional API routes
```

## 🤖 AI Agents

### المحاسب الذكي (Smart Accountant)
- VAT calculations
- Zakat calculations  
- ZATCA compliance
- Financial reporting

### السكرتير الرقمي (Digital Secretary)
- Meeting scheduling
- Email drafting
- Task management
- Document organization

### المبرمج المساعد (Programming Assistant)
- Code generation
- Bug fixing
- Code review
- Technical documentation

### مستشار التسويق (Marketing Consultant)
- Marketing strategies
- Campaign planning
- Market analysis
- Content creation

## 💳 Subscription Tiers

- **Free Trial**: 14 days, basic features
- **Standard Junior**: 299 SAR/month
- **Standard Senior**: 599 SAR/month  
- **Professional**: 999 SAR/month
- **Enterprise**: 1999 SAR/month

## 🔐 Security Features

- JWT authentication
- Rate limiting
- CORS protection
- Input validation
- SQL injection prevention
- XSS protection

## 📊 Monitoring & Analytics

- Real-time usage tracking
- Performance monitoring
- Error logging
- Business analytics
- User behavior insights

## 🌍 Deployment

### Vercel (Recommended)

1. **Connect to GitHub**
2. **Configure environment variables in Vercel dashboard**
3. **Deploy automatically on push**

### Manual Deployment

```bash
npm run build
npm run start:production
```

## 🧪 Testing

```bash
# Test all production services
node test_production_services.js

# Run unit tests
npm test

# Run integration tests
npm run test:integration
```

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### AI Chat
- `POST /api/chat` - Send message to AI agent
- `GET /api/chat/agents` - List available agents

### Subscriptions
- `GET /api/subscription/tiers` - Get subscription tiers
- `POST /api/subscription/create` - Create subscription
- `GET /api/subscription/:id` - Get subscription details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@doganai.com
- 💬 Discord: [Join our community](https://discord.gg/doganai)
- 📖 Documentation: [docs.doganai.com](https://docs.doganai.com)

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Supabase for database services
- Vercel for hosting platform
- All contributors and beta testers

---

**Built with ❤️ for the Saudi Arabian business community**