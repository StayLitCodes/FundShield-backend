import { Controller, Get } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger"
import {
  type HealthCheckService,
  HealthCheck,
  type TypeOrmHealthIndicator,
  type MemoryHealthIndicator,
  type DiskHealthIndicator,
} from "@nestjs/terminus"
import Redis from "ioredis"

@ApiTags("Health")
@Controller("health")
export class HealthController {
  private readonly redis: Redis

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number.parseInt(process.env.REDIS_PORT) || 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    })
  }

  @Get()
  @ApiOperation({ summary: "Get application health status" })
  @ApiResponse({ status: 200, description: "Health check passed" })
  @ApiResponse({ status: 503, description: "Health check failed" })
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health check
      () => this.db.pingCheck("database"),

      // Redis health check
      () => this.checkRedis(),

      // Memory health check (heap should not use more than 300MB)
      () => this.memory.checkHeap("memory_heap", 300 * 1024 * 1024),

      // Memory health check (RSS should not use more than 300MB)
      () => this.memory.checkRSS("memory_rss", 300 * 1024 * 1024),

      // Disk health check (should not use more than 80% of available space)
      () =>
        this.disk.checkStorage("storage", {
          path: "/",
          thresholdPercent: 0.8,
        }),
    ])
  }

  @Get("ready")
  @ApiOperation({ summary: "Get application readiness status" })
  @ApiResponse({ status: 200, description: "Application is ready" })
  @ApiResponse({ status: 503, description: "Application is not ready" })
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.db.pingCheck("database"), () => this.checkRedis()])
  }

  @Get("live")
  @ApiOperation({ summary: "Get application liveness status" })
  @ApiResponse({ status: 200, description: "Application is alive" })
  @ApiResponse({ status: 503, description: "Application is not alive" })
  @HealthCheck()
  liveness() {
    return this.health.check([() => this.memory.checkHeap("memory_heap", 500 * 1024 * 1024)])
  }

  @Get("metrics")
  @ApiOperation({ summary: "Get application metrics for Prometheus" })
  async metrics() {
    const memoryUsage = process.memoryUsage()
    const uptime = process.uptime()

    return {
      timestamp: new Date().toISOString(),
      uptime: uptime,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    }
  }

  private async checkRedis() {
    try {
      await this.redis.ping()
      return {
        redis: {
          status: "up",
        },
      }
    } catch (error) {
      throw new Error(`Redis health check failed: ${error.message}`)
    }
  }
}
