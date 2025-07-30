import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { CreateSignatureDto, VerifySignatureDto, KeyPairDto } from '../dto/signature.dto';

@Injectable()
export class DigitalSignatureService {
  private readonly logger = new Logger(DigitalSignatureService.name);

  /**
   * Generate RSA key pair for digital signatures
   */
  generateRSAKeyPair(keySize: number = 2048): KeyPairDto {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      return {
        publicKey,
        privateKey,
        algorithm: 'RSA',
        keySize,
      };
    } catch (error) {
      this.logger.error(`Error generating RSA key pair: ${error.message}`);
      throw new Error('Failed to generate RSA key pair');
    }
  }

  /**
   * Generate ECDSA key pair for digital signatures
   */
  generateECDSAKeyPair(curve: string = 'secp256k1'): KeyPairDto {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: curve,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      return {
        publicKey,
        privateKey,
        algorithm: 'ECDSA',
        curve,
      };
    } catch (error) {
      this.logger.error(`Error generating ECDSA key pair: ${error.message}`);
      throw new Error('Failed to generate ECDSA key pair');
    }
  }

  /**
   * Create digital signature
   */
  createSignature(dto: CreateSignatureDto): string {
    try {
      const sign = crypto.createSign(dto.algorithm || 'SHA256');
      sign.update(dto.data);
      sign.end();
      
      const signature = sign.sign(dto.privateKey, 'base64');
      
      this.logger.log(`Digital signature created using ${dto.algorithm || 'SHA256'}`);
      return signature;
    } catch (error) {
      this.logger.error(`Error creating signature: ${error.message}`);
      throw new Error('Failed to create digital signature');
    }
  }

  /**
   * Verify digital signature
   */
  verifySignature(dto: VerifySignatureDto): boolean {
    try {
      const verify = crypto.createVerify(dto.algorithm || 'SHA256');
      verify.update(dto.data);
      verify.end();
      
      const isValid = verify.verify(dto.publicKey, dto.signature, 'base64');
      
      this.logger.log(`Signature verification result: ${isValid}`);
      return isValid;
    } catch (error) {
      this.logger.error(`Error verifying signature: ${error.message}`);
      return false;
    }
  }
}