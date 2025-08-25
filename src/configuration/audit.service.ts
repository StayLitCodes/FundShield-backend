import { Injectable, Logger } from '@nestjs/common';

interface AuditRecord {
  user: string;
  timestamp: Date;
  change: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly records: AuditRecord[] = [];

  logChange(user: string, change: any) {
    const record: AuditRecord = { user, timestamp: new Date(), change };
    this.records.push(record);
    this.logger.log(`Audit: ${user} changed config at ${record.timestamp}: ${JSON.stringify(change)}`);
  }

  getRecords() {
    return this.records;
  }
}
