import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CryptoService } from './crypto.service';
import { KeyRotationDto, KeyStorageDto, MasterKeyDto } from '../dto/key-management.dto';

@Injectable()
export class KeyManagementService {
  private readonly logger = new Logger(KeyManagementService.name);
  private readonly keyStore = new Map<string, any>();
  private masterKey: Buffer;

  constructor(
    private configService: ConfigService,
    private cryptoService: CryptoService,
  ) {
    this.initializeMasterKey();
  }

  /**
   * Initialize master key from environment or generate new one
   */
  private initializeMasterKey(): void {
    const masterKeyHex = this.configService.get<string>('MASTER_KEY');
    
    if (masterKeyHex) {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
    } else {
      this.masterKey = this.cryptoService.generateSecureRandom(32);
      this.logger.warn('No master key found in environment. Generated new master key.');
    }
  }

  /**
   * Generate encryption key
   */
  generateEncryptionKey(keySize: number = 32): Buffer {
    return this.cryptoService.generateSecureRandom(keySize);
  }

  /**
   * Store key securely
   */
  storeKey(dto: KeyStorageDto): string {
    try {
      const keyId = this.cryptoService.generateUUID();
      const encryptedKey = this.encryptWithMasterKey(dto.key);
      
      this.keyStore.set(keyId, {
        encryptedKey,
        metadata: dto.metadata,
        createdAt: new Date(),
        algorithm: dto.algorithm,
      });
      
      this.logger.log(`Key stored with ID: ${keyId}`);
      return keyId;
    } catch (error) {
      this.logger.error(`Error storing key: ${error.message}`);
      throw new Error('Failed to store key');
    }
  }

  /**
   * Retrieve key by ID
   */
  retrieveKey(keyId: string): Buffer {
    try {
      const keyData = this.keyStore.get(keyId);
      
      if (!keyData) {
        throw new Error('Key not found');
      }
      
      return this.decryptWithMasterKey(keyData.encryptedKey);
    } catch (error) {
      this.logger.error(`Error retrieving key: ${error.message}`);
      throw new Error('Failed to retrieve key');
    }
  }

  /**
   * Rotate key
   */
  rotateKey(dto: KeyRotationDto): string {
    try {
      const oldKey = this.retrieveKey(dto.oldKeyId);
      const newKey = this.generateEncryptionKey(dto.keySize);
      
      // Store new key
      const newKeyId = this.storeKey({
        key: newKey,
        algorithm: dto.algorithm,
        metadata: { ...dto.metadata, rotatedFrom: dto.oldKeyId },
      });
      
      // Mark old key as rotated
      const oldKeyData = this.keyStore.get(dto.oldKeyId);
      if (oldKeyData) {
        oldKeyData.rotatedTo = newKeyId;
        oldKeyData.rotatedAt = new Date();
      }
      
      this.logger.log(`Key rotated from ${dto.oldKeyId} to ${newKeyId}`);
      return newKeyId;
    } catch (error) {
      this.logger.error(`Error rotating key: ${error.message}`);
      throw new Error('Failed to rotate key');
    }
  }

  /**
   * Delete key
   */
  deleteKey(keyId: string): boolean {
    try {
      const deleted = this.keyStore.delete(keyId);
      
      if (deleted) {
        this.logger.log(`Key deleted: ${keyId}`);
      }
      
      return deleted;
    } catch (error) {
      this.logger.error(`Error deleting key: ${error.message}`);
      return false;
    }
  }

  /**
   * List all keys with metadata
   */
  listKeys(): Array<{ keyId: string; metadata: any; createdAt: Date }> {
    const keys = [];
    
    for (const [keyId, keyData] of this.keyStore.entries()) {
      keys.push({
        keyId,
        metadata: keyData.metadata,
        createdAt: keyData.createdAt,
      });
    }
    
    return keys;
  }

  /**
   * Encrypt data with master key
   */
  private encryptWithMasterKey(data: Buffer): string {
    const iv = this.cryptoService.generateSecureRandom(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.masterKey);
    
    let encrypted = cipher.update(data, null, 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    });
  }

  /**
   * Decrypt data with master key
   */
  private decryptWithMasterKey(encryptedData: string): Buffer {
    const { encrypted, iv, authTag } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipher('aes-256-gcm', this.masterKey);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex');
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }
}