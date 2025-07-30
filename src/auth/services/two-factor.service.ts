import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import { User } from '../entities/user.entity';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(private configService: ConfigService) {}

  generateSecret(user: User): { secret: string; qrCodeUrl: string } {
    const secret = speakeasy.generateSecret({
      name: `FundShield (${user.email})`,
      issuer: 'FundShield',
      length: 32,
    });

    const qrCodeUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: user.email,
      issuer: 'FundShield',
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  verifyToken(token: string, secret: string): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps (1 minute) of clock skew
      });
    } catch (error) {
      this.logger.error(`Error verifying 2FA token: ${error.message}`);
      return false;
    }
  }

  verifyBackupCode(code: string, user: User): boolean {
    try {
      const backupCodes = user.getTwoFactorBackupCodes();
      const index = backupCodes.indexOf(code.toUpperCase());
      
      if (index !== -1) {
        // Remove the used backup code
        backupCodes.splice(index, 1);
        user.twoFactorBackupCodes = JSON.stringify(backupCodes);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Error verifying backup code: ${error.message}`);
      return false;
    }
  }

  generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(3).toString('hex').toUpperCase());
    }
    return codes;
  }

  isTokenExpired(token: string): boolean {
    // This is a simple implementation. In a real-world scenario,
    // you might want to track used tokens to prevent replay attacks
    return false;
  }

  getRemainingTime(): number {
    const now = Math.floor(Date.now() / 1000);
    return 30 - (now % 30);
  }
} 