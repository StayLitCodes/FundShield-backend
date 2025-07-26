import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { EmailService } from '../services/email.service';
import { TwoFactorService } from '../services/two-factor.service';
import { SessionService } from '../services/session.service';
import { User, UserStatus, UserRole } from '../entities/user.entity';
import { LoginDto, RegisterDto } from '../dto/auth.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let configService: ConfigService;
  let emailService: EmailService;
  let twoFactorService: TwoFactorService;
  let sessionService: SessionService;

  const mockUser: Partial<User> = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    emailVerified: true,
    twoFactorEnabled: false,
    loginAttempts: 0,
    lockoutUntil: null,
    validatePassword: jest.fn(),
    incrementLoginAttempts: jest.fn(),
    resetLoginAttempts: jest.fn(),
    isLocked: jest.fn(),
    hasRole: jest.fn(),
    hasAnyRole: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
            sendTwoFactorSetupEmail: jest.fn(),
            sendLoginAlertEmail: jest.fn(),
          },
        },
        {
          provide: TwoFactorService,
          useValue: {
            verifyToken: jest.fn(),
            generateSecret: jest.fn(),
            verifyBackupCode: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            storeRefreshToken: jest.fn(),
            getRefreshToken: jest.fn(),
            invalidateRefreshToken: jest.fn(),
            blacklistToken: jest.fn(),
            isTokenBlacklisted: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    emailService = module.get<EmailService>(EmailService);
    twoFactorService = module.get<TwoFactorService>(TwoFactorService);
    sessionService = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const user = { ...mockUser } as User;
      user.validatePassword = jest.fn().mockResolvedValue(true);
      user.resetLoginAttempts = jest.fn();

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual(user);
      expect(user.validatePassword).toHaveBeenCalledWith('password');
      expect(user.resetLoginAttempts).toHaveBeenCalled();
    });

    it('should return null when user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      const user = { ...mockUser } as User;
      user.validatePassword = jest.fn().mockResolvedValue(false);
      user.incrementLoginAttempts = jest.fn();

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
      expect(user.incrementLoginAttempts).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      identifier: 'test@example.com',
      password: 'password',
    };

    it('should return auth response when login is successful', async () => {
      const user = { ...mockUser } as User;
      user.validatePassword = jest.fn().mockResolvedValue(true);
      user.resetLoginAttempts = jest.fn();
      user.isLocked = jest.fn().mockReturnValue(false);

      jest.spyOn(service, 'validateUser').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-token');
      jest.spyOn(sessionService, 'storeRefreshToken').mockResolvedValue();
      jest.spyOn(emailService, 'sendLoginAlertEmail').mockResolvedValue();
      jest.spyOn(configService, 'get').mockReturnValue(3600);

      const result = await service.login(loginDto, '127.0.0.1');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is not active', async () => {
      const user = { ...mockUser, status: UserStatus.PENDING } as User;
      user.validatePassword = jest.fn().mockResolvedValue(true);

      jest.spyOn(service, 'validateUser').mockResolvedValue(user);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is locked', async () => {
      const user = { ...mockUser } as User;
      user.validatePassword = jest.fn().mockResolvedValue(true);
      user.isLocked = jest.fn().mockReturnValue(true);

      jest.spyOn(service, 'validateUser').mockResolvedValue(user);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(UnauthorizedException);
    });

    it('should require 2FA code when 2FA is enabled', async () => {
      const user = { ...mockUser, twoFactorEnabled: true } as User;
      user.validatePassword = jest.fn().mockResolvedValue(true);
      user.isLocked = jest.fn().mockReturnValue(false);

      jest.spyOn(service, 'validateUser').mockResolvedValue(user);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should create new user successfully', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as User);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as User);
      jest.spyOn(emailService, 'sendVerificationEmail').mockResolvedValue();

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('user');
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should throw BadRequestException when passwords do not match', async () => {
      const invalidDto = { ...registerDto, confirmPassword: 'different' };

      await expect(service.register(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when email already exists', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when username already exists', async () => {
      jest.spyOn(userRepository, 'findOne')
        .mockResolvedValueOnce(null) // First call for email check
        .mockResolvedValueOnce(mockUser as User); // Second call for username check

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('refreshToken', () => {
    const refreshTokenDto = { refreshToken: 'valid-refresh-token' };

    it('should return new tokens when refresh token is valid', async () => {
      const payload = { sub: '1', email: 'test@example.com', username: 'testuser', role: 'user' };
      const user = { ...mockUser } as User;

      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
      jest.spyOn(service, 'findById').mockResolvedValue(user);
      jest.spyOn(sessionService, 'getRefreshToken').mockResolvedValue('valid-refresh-token');
      jest.spyOn(jwtService, 'sign').mockReturnValue('new-token');
      jest.spyOn(sessionService, 'storeRefreshToken').mockResolvedValue();
      jest.spyOn(configService, 'get').mockReturnValue(3600);

      const result = await service.refreshToken(refreshTokenDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should blacklist token and invalidate session', async () => {
      jest.spyOn(sessionService, 'blacklistToken').mockResolvedValue();
      jest.spyOn(sessionService, 'invalidateRefreshToken').mockResolvedValue();
      jest.spyOn(sessionService, 'invalidateUserSession').mockResolvedValue();
      jest.spyOn(configService, 'get').mockReturnValue(3600);

      await service.logout('1', 'access-token');

      expect(sessionService.blacklistToken).toHaveBeenCalledWith('access-token', 3600);
      expect(sessionService.invalidateRefreshToken).toHaveBeenCalledWith('1');
      expect(sessionService.invalidateUserSession).toHaveBeenCalledWith('1');
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto = { email: 'test@example.com' };

    it('should send password reset email when user exists', async () => {
      const user = { ...mockUser } as User;
      jest.spyOn(service, 'findByEmail').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue();

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toHaveProperty('message');
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should return success message even when user does not exist (security)', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toHaveProperty('message');
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto = {
      token: 'valid-token',
      password: 'NewPassword123!',
      confirmPassword: 'NewPassword123!',
    };

    it('should reset password successfully', async () => {
      const user = { ...mockUser } as User;
      user.resetLoginAttempts = jest.fn();

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

      const result = await service.resetPassword(resetPasswordDto);

      expect(result).toHaveProperty('message');
      expect(user.resetLoginAttempts).toHaveBeenCalled();
    });

    it('should throw BadRequestException when passwords do not match', async () => {
      const invalidDto = { ...resetPasswordDto, confirmPassword: 'different' };

      await expect(service.resetPassword(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when token is invalid', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail', () => {
    const verifyEmailDto = { token: 'valid-token' };

    it('should verify email successfully', async () => {
      const user = { ...mockUser, emailVerified: false, status: UserStatus.PENDING } as User;

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

      const result = await service.verifyEmail(verifyEmailDto);

      expect(result).toHaveProperty('message');
      expect(user.emailVerified).toBe(true);
      expect(user.status).toBe(UserStatus.ACTIVE);
    });

    it('should throw BadRequestException when token is invalid', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'oldpassword',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    };

    it('should change password successfully', async () => {
      const user = { ...mockUser } as User;
      user.validatePassword = jest.fn().mockResolvedValue(true);
      user.resetLoginAttempts = jest.fn();

      jest.spyOn(service, 'findById').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

      const result = await service.changePassword('1', changePasswordDto);

      expect(result).toHaveProperty('message');
      expect(user.resetLoginAttempts).toHaveBeenCalled();
    });

    it('should throw BadRequestException when current password is incorrect', async () => {
      const user = { ...mockUser } as User;
      user.validatePassword = jest.fn().mockResolvedValue(false);

      jest.spyOn(service, 'findById').mockResolvedValue(user);

      await expect(service.changePassword('1', changePasswordDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when new passwords do not match', async () => {
      const invalidDto = { ...changePasswordDto, confirmNewPassword: 'different' };

      await expect(service.changePassword('1', invalidDto)).rejects.toThrow(BadRequestException);
    });
  });
}); 