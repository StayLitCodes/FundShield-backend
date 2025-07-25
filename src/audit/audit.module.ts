import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { ComplianceRule } from './entities/compliance-rule.entity';
import { ComplianceService } from './compliance.service';
import { AuditReportService } from './audit-report.service';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, ComplianceRule])],
  providers: [AuditService, ComplianceService, AuditReportService, DataRetentionService],
  exports: [AuditService, ComplianceService, AuditReportService, DataRetentionService],
})
export class AuditModule {} 