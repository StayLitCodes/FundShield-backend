import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './services/crypto.service';
import { KeyManagementService } from './services/key-management.service';
import { DigitalSignatureService } from './services/digital-signature.service';
import { EncryptionService } from './services/encryption.service';
import { HashService } from './services/hash.service';
import { BlockchainCryptoService } from './services/blockchain-crypto.service';
import { HsmService } from './services/hsm.service';
import { CryptoController } from './controllers/crypto.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    CryptoService,
    KeyManagementService,
    DigitalSignatureService,
    EncryptionService,
    HashService,
    BlockchainCryptoService,
    HsmService,
  ],
  controllers: [CryptoController],
  exports: [
    CryptoService,
    KeyManagementService,
    DigitalSignatureService,
    EncryptionService,
    HashService,
    BlockchainCryptoService,
    HsmService,
  ],
})
export class CryptoModule {}