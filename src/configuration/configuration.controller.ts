import { Controller, Get, Patch, Body, Query } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { UpdateConfigurationDto } from './dto/update-configuration.dto';
import { AuditTrailService } from './audit-trail.service';

@Controller('configuration')
export class ConfigurationController {
  constructor(
    private readonly configService: ConfigurationService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  @Get()
  getConfig(@Query('key') key: string) {
    return this.configService.get(key);
  }

  @Patch()
  async updateConfig(@Body() updateDto: UpdateConfigurationDto) {
    const result = await this.configService.update(updateDto.key, updateDto.value);
    await this.auditTrailService.logChange(updateDto.key, updateDto.value);
    return result;
  }
}
