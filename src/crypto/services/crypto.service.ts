import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CryptoUtilsDto, SecureRandomDto } from '../dto/crypto.dto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Generate cryptographically secure random bytes
   */
  generateSecureRandom(length: number): Buffer {
    try {
      return crypto.randomBytes(length);
    } catch (error) {
      this.logger.error(`Error generating secure random: ${error.message}`);
      throw new Error('Failed to generate secure random bytes');
    }
  }

  /**
   * Generate secure random string with specified encoding
   */
  generateSecureRandomString(dto: SecureRandomDto): string {
    const buffer = this.generateSecureRandom(dto.length);
    return buffer.toString(dto.encoding || 'hex');
  }

  /**
   * Generate UUID v4
   */
  generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    
    return crypto.timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Generate cryptographic nonce
   */
  generateNonce(length: number = 32): string {
    return this.generateSecureRandom(length).toString('hex');
  }

  /**
   * Derive key using PBKDF2
   */
  deriveKey(password: string, salt: Buffer, iterations: number = 100000, keyLength: number = 32): Buffer {
    return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
  }

  /**
   * Generate salt for key derivation
   */
  generateSalt(length: number = 32): Buffer {
    return this.generateSecureRandom(length);
  }
}