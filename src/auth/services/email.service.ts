import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {}

  async sendVerificationEmail(email: string, token: string, username: string): Promise<void> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;
    
    const emailContent = {
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to FundShield!</h2>
          <p>Hi ${username},</p>
          <p>Thank you for registering with FundShield. Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account with FundShield, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from FundShield. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await this.sendEmail(emailContent);
  }

  async sendPasswordResetEmail(email: string, token: string, username: string): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
    
    const emailContent = {
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hi ${username},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from FundShield. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await this.sendEmail(emailContent);
  }

  async sendTwoFactorSetupEmail(email: string, username: string, backupCodes: string[]): Promise<void> {
    const emailContent = {
      to: email,
      subject: 'Two-Factor Authentication Setup Complete',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Two-Factor Authentication Enabled</h2>
          <p>Hi ${username},</p>
          <p>Two-factor authentication has been successfully enabled for your FundShield account.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Backup Codes</h3>
            <p>Please save these backup codes in a secure location. You can use them to access your account if you lose your authenticator device:</p>
            <div style="font-family: monospace; background-color: white; padding: 15px; border-radius: 3px;">
              ${backupCodes.map(code => `<div style="margin: 5px 0;">${code}</div>`).join('')}
            </div>
          </div>
          <p><strong>Important:</strong> Keep these codes safe and don't share them with anyone.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from FundShield. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await this.sendEmail(emailContent);
  }

  async sendLoginAlertEmail(email: string, username: string, loginInfo: any): Promise<void> {
    const emailContent = {
      to: email,
      subject: 'New Login Detected',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Login Alert</h2>
          <p>Hi ${username},</p>
          <p>We detected a new login to your FundShield account:</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${loginInfo.ip}</p>
            <p><strong>Location:</strong> ${loginInfo.location || 'Unknown'}</p>
            <p><strong>Device:</strong> ${loginInfo.userAgent || 'Unknown'}</p>
          </div>
          <p>If this was you, you can safely ignore this email.</p>
          <p>If you don't recognize this login, please contact support immediately.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from FundShield. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await this.sendEmail(emailContent);
  }

  private async sendEmail(emailContent: any): Promise<void> {
    // In a real implementation, you would integrate with an email service like:
    // - SendGrid
    // - AWS SES
    // - Nodemailer with SMTP
    // - Mailgun
    // - etc.
    
    this.logger.log(`Email would be sent to ${emailContent.to}: ${emailContent.subject}`);
    this.logger.debug(`Email content: ${JSON.stringify(emailContent, null, 2)}`);
    
    // For development, you might want to log the email content instead of actually sending
    if (this.configService.get('NODE_ENV') === 'development') {
      this.logger.log('Email sending skipped in development mode');
      return;
    }
    
    // TODO: Implement actual email sending logic
    // Example with a hypothetical email service:
    // await this.emailProvider.send(emailContent);
  }
} 