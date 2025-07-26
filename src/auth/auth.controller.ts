import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { EmailService } from './services/email.service';
import { TwoFactorService } from './services/two-factor.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Public, Roles, Admin, User } from './decorators/auth.decorators';
import { User as UserEntity, UserRole } from './entities/user.entity';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  EnableTwoFactorDto,
  DisableTwoFactorDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private authService: AuthService,
    private emailService: EmailService,
    private twoFactorService: TwoFactorService,
  ) {}

  @Post('login')
  @Public()
  @Throttle(5, 300) // 5 attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() loginDto: LoginDto, @Request() req: any) {
    return this.authService.login(loginDto, req.ip);
  }

  @Post('register')
  @Public()
  @Throttle(3, 3600) // 3 registrations per hour
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User registration' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @Public()
  @Throttle(10, 300) // 10 refresh attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Request() req: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new BadRequestException('No token provided');
    }
    await this.authService.logout(req.user.id, token);
    return { message: 'Logout successful' };
  }

  @Post('forgot-password')
  @Public()
  @Throttle(3, 3600) // 3 requests per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @Public()
  @Throttle(5, 3600) // 5 attempts per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('verify-email')
  @Public()
  @Throttle(5, 3600) // 5 attempts per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @Public()
  @Throttle(3, 3600) // 3 requests per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async resendVerification(@Body() resendVerificationDto: ResendVerificationDto) {
    return this.authService.resendVerification(resendVerificationDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @User()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user profile' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req: any) {
    return { user: req.user };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @User()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid profile data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Request() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.id, updateProfileDto);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @User()
  @Throttle(5, 3600) // 5 attempts per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiBearerAuth()
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid password data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @User()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get 2FA setup information' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '2FA setup info retrieved' })
  @ApiResponse({ status: 400, description: '2FA already enabled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTwoFactorSetup(@Request() req: any) {
    const user = req.user as UserEntity;
    
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const { secret, qrCodeUrl } = this.twoFactorService.generateSecret(user);
    
    // Store the secret temporarily (in a real app, you might want to store it in Redis)
    // For now, we'll return it directly
    return {
      secret,
      qrCodeUrl,
      message: 'Scan the QR code with your authenticator app',
    };
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @User()
  @Throttle(5, 300) // 5 attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  @ApiBearerAuth()
  @ApiBody({ type: EnableTwoFactorDto })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code or already enabled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async enableTwoFactor(
    @Request() req: any,
    @Body() enableTwoFactorDto: EnableTwoFactorDto,
  ) {
    return this.authService.enableTwoFactor(req.user.id, enableTwoFactorDto);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @User()
  @Throttle(5, 300) // 5 attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  @ApiBearerAuth()
  @ApiBody({ type: DisableTwoFactorDto })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code or not enabled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async disableTwoFactor(
    @Request() req: any,
    @Body() disableTwoFactorDto: DisableTwoFactorDto,
  ) {
    return this.authService.disableTwoFactor(req.user.id, disableTwoFactorDto);
  }

  @Get('2fa/backup-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @User()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get 2FA backup codes' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Backup codes retrieved' })
  @ApiResponse({ status: 400, description: '2FA not enabled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBackupCodes(@Request() req: any) {
    const user = req.user as UserEntity;
    
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const backupCodes = user.getTwoFactorBackupCodes();
    
    return {
      backupCodes,
      message: 'Keep these codes safe. You can use them to access your account if you lose your authenticator device.',
    };
  }

  @Post('2fa/regenerate-backup-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @User()
  @Throttle(3, 3600) // 3 requests per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate 2FA backup codes' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Backup codes regenerated' })
  @ApiResponse({ status: 400, description: '2FA not enabled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async regenerateBackupCodes(@Request() req: any) {
    const user = req.user as UserEntity;
    
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const backupCodes = user.generateTwoFactorBackupCodes();
    await this.authService['userRepository'].save(user);

    // Send new backup codes email
    await this.emailService.sendTwoFactorSetupEmail(
      user.email,
      user.username,
      backupCodes,
    );

    return {
      backupCodes,
      message: 'New backup codes generated and sent to your email',
    };
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Admin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAllUsers() {
    // This would be implemented in the auth service
    // For now, returning a placeholder
    return { message: 'Get all users endpoint - to be implemented' };
  }
} 