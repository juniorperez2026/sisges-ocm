import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { SqlServerConnectionService } from '../../shared/infrastructure/database/sql-server/sql-server-connection.service';

@Injectable()
export class SqlServerHealthIndicator {
  private readonly logger = new Logger(SqlServerHealthIndicator.name);

  constructor(
    private readonly sqlServer: SqlServerConnectionService,

    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    if (!this.sqlServer.isEnabled()) {
      return indicator.up({
        enabled: false,
      });
    }

    const startedAt = Date.now();

    try {
      await this.sqlServer.ping();

      return indicator.up({
        enabled: true,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error: unknown) {
      this.logger.error({
        event: 'sql_server_health_check_failed',
        ...this.resolveError(error),
      });

      return indicator.down({
        enabled: true,
        message: 'SQL Server connectivity check failed',
      });
    }
  }

  private resolveError(error: unknown): Readonly<Record<string, unknown>> {
    if (!(error instanceof Error)) {
      return {
        errorName: 'UnknownError',
        message: String(error),
      };
    }

    const errorWithCode = error as Error & {
      code?: unknown;
    };

    return {
      errorName: error.name,
      message: error.message,

      ...(typeof errorWithCode.code === 'string'
        ? {
            code: errorWithCode.code,
          }
        : {}),
    };
  }
}
