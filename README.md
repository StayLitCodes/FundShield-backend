# FundShield Backend

> Secure fund management platform backend built with NestJS and TypeScript

## 🚀 Features

- **Modern Architecture**: Built with NestJS, TypeScript, and PostgreSQL
- **Blockchain Integration**: Starknet smart contract interaction
- **Security First**: JWT authentication, input validation, rate limiting
- **Developer Experience**: Hot reload, comprehensive testing, API documentation
- **Production Ready**: Docker containerization, CI/CD pipeline, monitoring

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fundshield-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   ```bash
   # Start PostgreSQL and Redis
   npm run migrate
   npm run seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Docker Development

```bash
# Start all services
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f app
```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api/v1/docs
- **Health Check**: http://localhost:3000/api/v1/health

## 🧪 Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

## 🏗️ Project Structure
