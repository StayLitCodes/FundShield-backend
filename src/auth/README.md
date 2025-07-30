# FundShield Authentication System

A comprehensive authentication system built with NestJS, featuring JWT-based authentication, role-based access control, two-factor authentication, and advanced security measures.

## 🚀 Features

### Core Authentication
- **JWT-based authentication** with access and refresh tokens
- **Password hashing** with bcrypt (12 salt rounds)
- **Session management** with Redis
- **Rate limiting** for authentication endpoints
- **Account lockout** after failed login attempts

### Role-Based Access Control (RBAC)
- **Multiple user roles**: Admin, Moderator, Auditor, User
- **Custom decorators** for role-based authorization
- **Flexible permission system** with role inheritance

### Two-Factor Authentication (2FA)
- **TOTP-based 2FA** using authenticator apps
- **QR code generation** for easy setup
- **Backup codes** for account recovery
- **Secure secret management**

### Email Verification & Password Reset
- **Email verification** for new accounts
- **Password reset** via secure tokens
- **Resend verification** functionality
- **HTML email templates**

### Security Features
- **Account lockout** after 5 failed login attempts (15-minute lockout)
- **Token blacklisting** for secure logout
- **IP tracking** for login monitoring
- **Login attempt monitoring**
- **Secure password requirements**

## 📁 Project Structure

```
src/auth/
├── entities/
│   └── user.entity.ts              # User entity with all authentication fields
├── dto/
│   └── auth.dto.ts                 # Data transfer objects for validation
├── decorators/
│   └── auth.decorators.ts          # Custom decorators for RBAC
├── guards/
│   ├── jwt-auth.guard.ts          # JWT authentication guard
│   └── roles.guard.ts             # Role-based access control guard
├── strategies/
│   ├── jwt.strategy.ts            # JWT Passport strategy
│   └── local.strategy.ts          # Local Passport strategy
├── services/
│   ├── email.service.ts           # Email service for notifications
│   ├── two-factor.service.ts      # 2FA service
│   └── session.service.ts         # Redis session management
├── tests/
│   ├── auth.service.spec.ts       # Auth service tests
│   ├── jwt-auth.guard.spec.ts     # JWT guard tests
│   ├── roles.guard.spec.ts        # Roles guard tests
│   └── two-factor.service.spec.ts # 2FA service tests
├── auth.controller.ts             # Authentication endpoints
├── auth.service.ts                # Main authentication logic
├── auth.module.ts                 # Module configuration
└── README.md                      # This file
```

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_REFRESH_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN_LONG=30d

# Frontend URL for email links
FRONTEND_URL=http://localhost:3000

# Redis Configuration (for sessions)
REDIS_HOST=localhost
REDIS_PORT=6379

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fundshield
DB_USER=postgres
DB_PASSWORD=password
```

## 🚀 Usage

### 1. User Registration

```typescript
// POST /auth/register
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

### 2. User Login

```typescript
// POST /auth/login
{
  "identifier": "john@example.com", // or username
  "password": "SecurePass123!",
  "twoFactorCode": "123456", // optional if 2FA is enabled
  "rememberMe": false
}
```

### 3. Using Role-Based Access Control

```typescript
import { Controller, Get } from '@nestjs/common';
import { Admin, User, Roles } from './auth/decorators/auth.decorators';
import { UserRole } from './auth/entities/user.entity';

@Controller('protected')
export class ProtectedController {
  
  // Only admins can access
  @Get('admin-only')
  @Admin()
  adminOnly() {
    return { message: 'Admin only content' };
  }

  // Users with any role can access
  @Get('user-content')
  @User()
  userContent() {
    return { message: 'User content' };
  }

  // Custom role requirements
  @Get('moderator-content')
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  moderatorContent() {
    return { message: 'Moderator content' };
  }
}
```

### 4. Two-Factor Authentication Setup

```typescript
// 1. Get 2FA setup info
// GET /auth/2fa/setup
// Returns: { secret, qrCodeUrl, message }

// 2. Enable 2FA
// POST /auth/2fa/enable
{
  "code": "123456" // from authenticator app
}

// 3. Get backup codes
// GET /auth/2fa/backup-codes
// Returns: { backupCodes: string[], message: string }
```

## 🔒 Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Account Protection
- **Brute force protection**: Account locked after 5 failed attempts
- **Lockout duration**: 15 minutes
- **Rate limiting**: Configurable per endpoint
- **Token blacklisting**: Secure logout with token invalidation

### Session Management
- **Redis-based sessions**: Scalable session storage
- **Refresh token rotation**: New refresh token on each use
- **Session invalidation**: Complete logout across devices

### Two-Factor Authentication
- **TOTP standard**: Compatible with Google Authenticator, Authy, etc.
- **Backup codes**: 10 one-time use codes for account recovery
- **Secure secret storage**: Encrypted in database
- **Time window**: 2-step tolerance for clock skew

## 🧪 Testing

Run the authentication tests:

```bash
# Run all auth tests
npm test src/auth

# Run specific test files
npm test auth.service.spec.ts
npm test jwt-auth.guard.spec.ts
npm test roles.guard.spec.ts
npm test two-factor.service.spec.ts

# Run with coverage
npm run test:cov
```

## 📧 Email Integration

The email service is designed to work with various email providers:

### Supported Providers
- SendGrid
- AWS SES
- Nodemailer (SMTP)
- Mailgun
- And more...

### Email Templates
- **Verification emails**: Welcome and account activation
- **Password reset**: Secure password recovery
- **2FA setup**: Backup codes and setup confirmation
- **Login alerts**: Security notifications

### Development Mode
In development, emails are logged to console instead of being sent.

## 🔄 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout

### Password Management
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- `PUT /auth/change-password` - Change password (authenticated)

### Email Verification
- `POST /auth/verify-email` - Verify email address
- `POST /auth/resend-verification` - Resend verification email

### Two-Factor Authentication
- `GET /auth/2fa/setup` - Get 2FA setup information
- `POST /auth/2fa/enable` - Enable 2FA
- `POST /auth/2fa/disable` - Disable 2FA
- `GET /auth/2fa/backup-codes` - Get backup codes
- `POST /auth/2fa/regenerate-backup-codes` - Regenerate backup codes

### Profile Management
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile

### Admin Only
- `GET /auth/users` - Get all users (Admin only)

## 🛡️ Security Best Practices

### 1. Token Management
- Use short-lived access tokens (1 hour)
- Use longer-lived refresh tokens (7 days)
- Implement token rotation
- Blacklist tokens on logout

### 2. Password Security
- Strong password requirements
- Secure password hashing (bcrypt)
- Account lockout protection
- Regular password changes

### 3. Session Security
- Redis-based session storage
- Session invalidation on logout
- IP tracking for suspicious activity
- Login attempt monitoring

### 4. Two-Factor Authentication
- TOTP standard compliance
- Backup codes for recovery
- Secure secret storage
- Time window tolerance

### 5. Rate Limiting
- Login attempts: 5 per 5 minutes
- Registration: 3 per hour
- Password reset: 3 per hour
- 2FA attempts: 5 per 5 minutes

## 🔧 Customization

### Adding New Roles
1. Update `UserRole` enum in `user.entity.ts`
2. Add new role decorators in `auth.decorators.ts`
3. Update role hierarchy logic

### Custom Email Templates
1. Modify email templates in `email.service.ts`
2. Add new email types as needed
3. Configure email provider settings

### Custom Validation
1. Update DTOs in `auth.dto.ts`
2. Add custom validators using class-validator
3. Implement custom validation pipes

## 🚨 Error Handling

The system provides comprehensive error handling:

- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Invalid credentials or missing authentication
- **403 Forbidden**: Insufficient permissions
- **409 Conflict**: Resource already exists
- **429 Too Many Requests**: Rate limit exceeded

## 📊 Monitoring

### Logging
- Authentication attempts
- Failed login attempts
- Account lockouts
- 2FA setup/usage
- Email sending status

### Metrics
- Login success/failure rates
- Account lockout frequency
- 2FA adoption rate
- Email delivery rates

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure security best practices
5. Test thoroughly before submitting

## 📄 License

This authentication system is part of the FundShield project and follows the same licensing terms. 