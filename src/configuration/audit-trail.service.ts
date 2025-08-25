import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  async logChange(key: string, value: string) {
    // In production, log to DB or external service
    this.logger.log(`Configuration changed: ${key} = ${value}`);
  }
}
