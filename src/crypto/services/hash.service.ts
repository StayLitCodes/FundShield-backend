import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { keccak256 } from 'js-sha3';
import { HashDataDto, VerifyHashDto } from '../dto/hash.dto';

@Injectable()
export class HashService {
  private readonly logger = new Logger(HashService.name);

  /**
   * Generate SHA-256 hash
   */
  sha256(data: string | Buffer): string {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(data);
      return hash.digest('hex');
    } catch (error) {
      this.logger.error(`Error generating SHA-256 hash: ${error.message}`);
      throw new Error('Failed to generate SHA-256 hash');
    }
  }

  /**
   * Generate Keccak-256 hash (used in Ethereum)
   */
  keccak256Hash(data: string | Buffer): string {
    try {
      const input = typeof data === 'string' ? data : data.toString();
      return keccak256(input);
    } catch (error) {
      this.logger.error(`Error generating Keccak-256 hash: ${error.message}`);
      throw new Error('Failed to generate Keccak-256 hash');
    }
  }

  /**
   * Generate hash with specified algorithm
   */
  generateHash(dto: HashDataDto): string {
    try {
      switch (dto.algorithm.toLowerCase()) {
        case 'sha256':
          return this.sha256(dto.data);
        case 'keccak256':
          return this.keccak256Hash(dto.data);
        case 'sha512':
          return crypto.createHash('sha512').update(dto.data).digest('hex');
        case 'md5':
          return crypto.createHash('md5').update(dto.data).digest('hex');
        default:
          throw new Error(`Unsupported hash algorithm: ${dto.algorithm}`);
      }
    } catch (error) {
      this.logger.error(`Error generating hash: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify hash
   */
  verifyHash(dto: VerifyHashDto): boolean {
    try {
      const computedHash = this.generateHash({
        data: dto.data,
        algorithm: dto.algorithm,
      });
      
      return crypto.timingSafeEqual(
        Buffer.from(computedHash, 'hex'),
        Buffer.from(dto.expectedHash, 'hex')
      );
    } catch (error) {
      this.logger.error(`Error verifying hash: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate HMAC
   */
  generateHMAC(data: string, secret: string, algorithm: string = 'sha256'): string {
    try {
      const hmac = crypto.createHmac(algorithm, secret);
      hmac.update(data);
      return hmac.digest('hex');
    } catch (error) {
      this.logger.error(`Error generating HMAC: ${error.message}`);
      throw new Error('Failed to generate HMAC');
    }
  }
}