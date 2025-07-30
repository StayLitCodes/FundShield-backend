import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CryptoService } from '../services/crypto.service';
import { DigitalSignatureService } from '../services/digital-signature.service';
import { EncryptionService } from '../services/encryption.service';
import { HashService } from '../services/hash.service';
import { KeyManagementService } from '../services/key-management.service';
import { BlockchainCryptoService } from '../services/blockchain-crypto.service';
import {
  CreateSignatureDto,
  VerifySignatureDto,
  EncryptDataDto,
  DecryptDataDto,
  HashDataDto,
  SecureRandomDto,
} from '../dto';

@ApiTags('crypto')
@Controller('crypto')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CryptoController {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly signatureService: DigitalSignatureService,
    private readonly encryptionService: EncryptionService,
    private readonly hashService: HashService,
    private readonly keyManagementService: KeyManagementService,
    private readonly blockchainCryptoService: BlockchainCryptoService,
  ) {}

  @Post('random')
  @ApiOperation({ summary: 'Generate secure random data' })
  @ApiResponse({ status: 200, description: 'Random data generated successfully' })
  generateRandom(@Body() dto: SecureRandomDto) {
    return {
      random: this.cryptoService.generateSecureRandomString(dto),
    };
  }

  @Post('signature/create')
  @ApiOperation({ summary: 'Create digital signature' })
  @ApiResponse({ status: 200, description: 'Signature created successfully' })
  createSignature(@Body() dto: CreateSignatureDto) {
    return {
      signature: this.signatureService.createSignature(dto),
    };
  }

  @Post('signature/verify')
  @ApiOperation({ summary: 'Verify digital signature' })
  @ApiResponse({ status: 200, description: 'Signature verification result' })
  verifySignature(@Body() dto: VerifySignatureDto) {
    return {
      valid: this.signatureService.verifySignature(dto),
    };
  }

  @Post('encrypt')
  @ApiOperation({ summary: 'Encrypt data' })
  @ApiResponse({ status: 200, description: 'Data encrypted successfully' })
  encryptData(@Body() dto: EncryptDataDto) {
    return this.encryptionService.encryptData(dto);
  }

  @Post('decrypt')
  @ApiOperation({ summary: 'Decrypt data' })
  @ApiResponse({ status: 200, description: 'Data decrypted successfully' })
  decryptData(@Body() dto: DecryptDataDto) {
    return {
      decryptedData: this.encryptionService.decryptData(dto),
    };
  }

  @Post('hash')
  @ApiOperation({ summary: 'Generate hash' })
  @ApiResponse({ status: 200, description: 'Hash generated successfully' })
  generateHash(@Body() dto: HashDataDto) {
    return {
      hash: this.hashService.generateHash(dto),
    };
  }

  @Get('keypair/rsa')
  @ApiOperation({ summary: 'Generate RSA key pair' })
  @ApiResponse({ status: 200, description: 'RSA key pair generated successfully' })
  generateRSAKeyPair() {
    return this.signatureService.generateRSAKeyPair();
  }

  @Get('keypair/ecdsa')
  @ApiOperation({ summary: 'Generate ECDSA key pair' })
  @ApiResponse({ status: 200, description: 'ECDSA key pair generated successfully' })
  generateECDSAKeyPair() {
    return this.signatureService.generateECDSAKeyPair();
  }

  @Get('wallet/generate')
  @ApiOperation({ summary: 'Generate blockchain wallet' })
  @ApiResponse({ status: 200, description: 'Wallet generated successfully' })
  generateWallet() {
    return this.blockchainCryptoService.generateWalletKeyPair();
  }

  @Get('keys')
  @ApiOperation({ summary: 'List managed keys' })
  @ApiResponse({ status: 200, description: 'Keys listed successfully' })
  listKeys() {
    return this.keyManagementService.listKeys();
  }
}