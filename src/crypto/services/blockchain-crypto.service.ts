import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ec as EC } from 'elliptic';
import { HashService } from './hash.service';
import { SignTransactionDto, VerifyTransactionDto } from '../dto/blockchain-crypto.dto';

@Injectable()
export class BlockchainCryptoService {
  private readonly logger = new Logger(BlockchainCryptoService.name);
  private readonly ec = new EC('secp256k1');

  constructor(private hashService: HashService) {}

  /**
   * Generate blockchain wallet key pair
   */
  generateWalletKeyPair(): { privateKey: string; publicKey: string; address: string } {
    try {
      const keyPair = this.ec.genKeyPair();
      const privateKey = keyPair.getPrivate('hex');
      const publicKey = keyPair.getPublic('hex');
      
      // Generate address from public key (simplified)
      const address = this.generateAddressFromPublicKey(publicKey);
      
      return {
        privateKey,
        publicKey,
        address,
      };
    } catch (error) {
      this.logger.error(`Error generating wallet key pair: ${error.message}`);
      throw new Error('Failed to generate wallet key pair');
    }
  }

  /**
   * Sign transaction for blockchain
   */
  signTransaction(dto: SignTransactionDto): string {
    try {
      const keyPair = this.ec.keyFromPrivate(dto.privateKey, 'hex');
      const transactionHash = this.hashService.keccak256Hash(dto.transactionData);
      
      const signature = keyPair.sign(transactionHash);
      
      return signature.toDER('hex');
    } catch (error) {
      this.logger.error(`Error signing transaction: ${error.message}`);
      throw new Error('Failed to sign transaction');
    }
  }

  /**
   * Verify transaction signature
   */
  verifyTransactionSignature(dto: VerifyTransactionDto): boolean {
    try {
      const keyPair = this.ec.keyFromPublic(dto.publicKey, 'hex');
      const transactionHash = this.hashService.keccak256Hash(dto.transactionData);
      
      return keyPair.verify(transactionHash, dto.signature);
    } catch (error) {
      this.logger.error(`Error verifying transaction signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate address from public key
   */
  private generateAddressFromPublicKey(publicKey: string): string {
    // Remove '04' prefix if present
    const cleanPublicKey = publicKey.startsWith('04') ? publicKey.slice(2) : publicKey;
    
    // Hash the public key
    const hash = this.hashService.keccak256Hash(Buffer.from(cleanPublicKey, 'hex'));
    
    // Take last 20 bytes and add '0x' prefix
    return '0x' + hash.slice(-40);
  }

  /**
   * Create message signature for blockchain
   */
  signMessage(message: string, privateKey: string): string {
    try {
      const keyPair = this.ec.keyFromPrivate(privateKey, 'hex');
      const messageHash = this.hashService.keccak256Hash(message);
      
      const signature = keyPair.sign(messageHash);
      
      return signature.toDER('hex');
    } catch (error) {
      this.logger.error(`Error signing message: ${error.message}`);
      throw new Error('Failed to sign message');
    }
  }

  /**
   * Recover public key from signature
   */
  recoverPublicKey(message: string, signature: string): string {
    try {
      const messageHash = this.hashService.keccak256Hash(message);
      
      // This is a simplified implementation
      // In practice, you'd need to implement proper recovery
      const recovered = this.ec.recoverPubKey(
        messageHash,
        signature,
        0 // recovery flag
      );
      
      return recovered.encode('hex');
    } catch (error) {
      this.logger.error(`Error recovering public key: ${error.message}`);
      throw new Error('Failed to recover public key');
    }
  }
}