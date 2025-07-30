import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { EncryptDataDto, DecryptDataDto, EncryptedDataDto } from '../dto/encryption.dto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly defaultAlgorithm = 'aes-256-gcm';

  /**
   * Encrypt data using AES-256-GCM
   */
  encryptData(dto: EncryptDataDto): EncryptedDataDto {
    try {
      const algorithm = dto.algorithm || this.defaultAlgorithm;
      const key = dto.key || crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher(algorithm, key);
      cipher.setAAD(Buffer.from(dto.additionalData || ''));
      
      let encrypted = cipher.update(dto.data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      this.logger.log(`Data encrypted using ${algorithm}`);
      
      return {
        encryptedData: encrypted,
        key: key.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm,
      };
    } catch (error) {
      this.logger.error(`Error encrypting data: ${error.message}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decryptData(dto: DecryptDataDto): string {
    try {
      const algorithm = dto.algorithm || this.defaultAlgorithm;
      const key = Buffer.from(dto.key, 'hex');
      const iv = Buffer.from(dto.iv, 'hex');
      const authTag = Buffer.from(dto.authTag, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, key);
      decipher.setAuthTag(authTag);
      
      if (dto.additionalData) {
        decipher.setAAD(Buffer.from(dto.additionalData));
      }
      
      let decrypted = decipher.update(dto.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      this.logger.log(`Data decrypted using ${algorithm}`);
      return decrypted;
    } catch (error) {
      this.logger.error(`Error decrypting data: ${error.message}`);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt file
   */
  encryptFile(filePath: string, key: Buffer): EncryptedDataDto {
    try {
      const fs = require('fs');
      const data = fs.readFileSync(filePath, 'utf8');
      
      return this.encryptData({
        data,
        key,
      });
    } catch (error) {
      this.logger.error(`Error encrypting file: ${error.message}`);
      throw new Error('Failed to encrypt file');
    }
  }
}