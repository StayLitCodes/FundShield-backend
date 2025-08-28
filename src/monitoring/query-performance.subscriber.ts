import { EventSubscriber, QueryRunner, EntitySubscriberInterface } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { PerformanceMetricsService } from '../monitoring/performance-metrics.service';

@Injectable()
@EventSubscriber()
export class QueryPerformanceSubscriber implements EntitySubscriberInterface {
  constructor(private readonly metricsService: PerformanceMetricsService) {}

  beforeQuery(event: { query: string; parameters?: any[]; queryRunner: QueryRunner }) {
    (event.queryRunner as any).__queryStart = process.hrtime.bigint();
  }

  afterQuery(event: { query: string; parameters?: any[]; queryRunner: QueryRunner }) {
    const start = (event.queryRunner as any).__queryStart;
    if (start) {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this.metricsService.recordRequest({
        route: '[DB] ' + event.query,
        durationMs,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      });
      if (durationMs > 500) {
        console.warn(`[DB] Slow query (${durationMs}ms): ${event.query}`);
      }
    }
  }
}
