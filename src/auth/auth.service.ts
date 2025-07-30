import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { User, UserStatus, UserRole } from './entities/user.entity';
import { EmailService } from './services/email.service';
import { TwoFactorService } from './services/two-factor.service';
import { SessionService } from './services/session.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  EnableTwoFactorDto,
  DisableTwoFactorDto,
  ChangePasswordDto,
  UpdateProfileDto,
  ResendVerificationDto,
} from './dto/auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Partial<User>;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private twoFactorService: TwoFactorService,
    private sessionService: SessionService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<User | null> {
    const user = await this.findByEmailOrUsername(identifier);
    
    if (!user) {
      return null;
    }

    const isPasswordValid = await user.validatePassword(password);
    
    if (!isPasswordValid) {
      user.incrementLoginAttempts();
      await this.userRepository.save(user);
      return null;
    }

    // Reset login attempts on successful login
    user.resetLoginAttempts();
    await this.userRepository.save(user);
    
    return user;
  }

  async login(loginDto: LoginDto, ipAddress: string): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.identifier, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.isLocked()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!loginDto.twoFactorCode) {
        throw new UnauthorizedException('Two-factor authentication code required');
      }

      const isValidCode = this.twoFactorService.verifyToken(
        loginDto.twoFactorCode,
        user.twoFactorSecret,
      );

      if (!isValidCode) {
        throw new UnauthorizedException('Invalid two-factor authentication code');
      }
    }

    // Update last login
    await this.updateLastLogin(user.id, ipAddress);

    // Generate tokens
    const tokens = await this.generateTokens(user, loginDto.rememberMe);

    // Send login alert email
    await this.emailService.sendLoginAlertEmail(user.email, user.username, {
      ip: ipAddress,
      userAgent: 'Unknown', // You can extract this from request headers
      location: 'Unknown', // You can use IP geolocation service
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
      expiresIn: this.configService.get('JWT_EXPIRES_IN', 3600),
    };
  }

  async register(registerDto: RegisterDto): Promise<{ message: string; user: Partial<User> }> {
    // Check if passwords match
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if user already exists
    const existingUser = await this.findByEmailOrUsername(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const existingUsername = await this.userRepository.findOne({
      where: { username: registerDto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Create new user
    const user = this.userRepository.create({
      username: registerDto.username,
      email: registerDto.email,
      password: registerDto.password,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: registerDto.role || UserRole.USER,
      status: UserStatus.PENDING,
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.userRepository.save(user);

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.username,
    );

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      user: this.sanitizeUser(user),
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if refresh token is stored in Redis
      const storedToken = await this.sessionService.getRefreshToken(user.id);
      if (!storedToken || storedToken !== refreshTokenDto.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user, false);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: this.sanitizeUser(user),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', 3600),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, accessToken: string): Promise<void> {
    // Blacklist the access token
    const tokenExpiry = this.configService.get('JWT_EXPIRES_IN', 3600);
    await this.sessionService.blacklistToken(accessToken, tokenExpiry);

    // Invalidate refresh token
    await this.sessionService.invalidateRefreshToken(userId);

    // Invalidate user session
    await this.sessionService.invalidateUserSession(userId);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.findByEmail(forgotPasswordDto.email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return { message: 'If an account with this email exists, a password reset link has been sent.' };
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userRepository.save(user);

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.username,
    );

    return { message: 'If an account with this email exists, a password reset link has been sent.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    if (resetPasswordDto.password !== resetPasswordDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: resetPasswordDto.token,
        passwordResetTokenExpires: new Date(),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Update password and clear reset token
    user.password = resetPasswordDto.password;
    user.passwordResetToken = null;
    user.passwordResetTokenExpires = null;
    user.resetLoginAttempts();

    await this.userRepository.save(user);

    return { message: 'Password has been reset successfully' };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: {
        emailVerificationToken: verifyEmailDto.token,
        emailVerificationTokenExpires: new Date(),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Verify email and activate account
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.status = UserStatus.ACTIVE;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;

    await this.userRepository.save(user);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(resendVerificationDto: ResendVerificationDto): Promise<{ message: string }> {
    const user = await this.findByEmail(resendVerificationDto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.userRepository.save(user);

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.username,
    );

    return { message: 'Verification email sent successfully' };
  }

  async enableTwoFactor(userId: string, enableTwoFactorDto: EnableTwoFactorDto): Promise<{ message: string; backupCodes: string[] }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    // Verify the code
    const isValidCode = this.twoFactorService.verifyToken(
      enableTwoFactorDto.code,
      user.twoFactorSecret,
    );

    if (!isValidCode) {
      throw new BadRequestException('Invalid two-factor authentication code');
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    const backupCodes = user.generateTwoFactorBackupCodes();

    await this.userRepository.save(user);

    // Send backup codes email
    await this.emailService.sendTwoFactorSetupEmail(
      user.email,
      user.username,
      backupCodes,
    );

    return {
      message: 'Two-factor authentication enabled successfully',
      backupCodes,
    };
  }

  async disableTwoFactor(userId: string, disableTwoFactorDto: DisableTwoFactorDto): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    // Verify the code
    const isValidCode = this.twoFactorService.verifyToken(
      disableTwoFactorDto.code,
      user.twoFactorSecret,
    );

    if (!isValidCode) {
      throw new BadRequestException('Invalid two-factor authentication code');
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = null;

    await this.userRepository.save(user);

    return { message: 'Two-factor authentication disabled successfully' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (changePasswordDto.newPassword !== changePasswordDto.confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.validatePassword(changePasswordDto.currentPassword);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Update password
    user.password = changePasswordDto.newPassword;
    user.resetLoginAttempts();

    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<{ message: string; user: Partial<User> }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateProfileDto.email);
      if (existingUser) {
        throw new ConflictException('Email is already taken');
      }
    }

    // Update user profile
    Object.assign(user, updateProfileDto);
    await this.userRepository.save(user);

    return {
      message: 'Profile updated successfully',
      user: this.sanitizeUser(user),
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: [
        { email: identifier },
        { username: identifier },
      ],
    });
  }

  async updateLastLogin(userId: string, ipAddress: string): Promise<void> {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    });
  }

  private async generateTokens(user: User, rememberMe: boolean = false): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '1h'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: rememberMe 
        ? this.configService.get('JWT_REFRESH_EXPIRES_IN_LONG', '30d')
        : this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Store refresh token in Redis
    const refreshExpiry = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 days or 7 days
    await this.sessionService.storeRefreshToken(user.id, refreshToken, refreshExpiry);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Partial<User> {
    const { password, emailVerificationToken, emailVerificationTokenExpires, passwordResetToken, passwordResetTokenExpires, twoFactorSecret, twoFactorBackupCodes, lockoutUntil, ...sanitizedUser } = user;
    return sanitizedUser;
  }
} 