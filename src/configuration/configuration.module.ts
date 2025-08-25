import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configuration } from './configuration.service';
import { JoiValidationSchema } from './validation.schema';
import { FeatureFlagService } from './feature-flag.service';
import { ConfigurationService } from './configuration.service';
import { ConfigurationController } from './configuration.controller';
import { AuditTrailService } from './audit-trail.service';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: JoiValidationSchema,
      cache: true,
    }),
  ],
  controllers: [ConfigurationController],
  providers: [
    ConfigurationService,
    FeatureFlagService,
    AuditTrailService,
  ],
  exports: [ConfigurationService, FeatureFlagService],
})
export class ConfigurationModule {}
