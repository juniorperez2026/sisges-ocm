import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

interface LivenessResponse {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly memoryHealthIndicator: MemoryHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  @Get('live')
  liveness(): LivenessResponse {
    return {
      status: 'ok',
      service:
        this.configService.get<string>('APP_NAME') ?? 'telefonia-backend',
      version: this.configService.get<string>('APP_VERSION') ?? '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () =>
        this.memoryHealthIndicator.checkHeap('memory_heap', 512 * 1024 * 1024),
      () =>
        this.memoryHealthIndicator.checkRSS('memory_rss', 1024 * 1024 * 1024),
    ]);
  }
}
