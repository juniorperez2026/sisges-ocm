import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectionPool, type config as SqlServerConfig } from 'mssql';

@Injectable()
export class LegacySqlServerConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(LegacySqlServerConnectionService.name);

  private readonly enabled: boolean;

  private readonly configuration: SqlServerConfig | null;

  private pool: ConnectionPool | null = null;

  private connectionPromise: Promise<ConnectionPool> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.getOrThrow<boolean>(
      'LEGACY_SQL_SERVER_ENABLED',
    );

    this.configuration = this.enabled ? this.createConfiguration() : null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async getPool(): Promise<ConnectionPool> {
    if (!this.enabled || !this.configuration) {
      throw new Error('Legacy SQL Server integration is disabled');
    }

    if (this.pool?.connected && this.pool.healthy) {
      return this.pool;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const candidatePool = new ConnectionPool(this.configuration);

    candidatePool.on('error', (error: Error) => {
      this.logger.error({
        event: 'legacy_sql_server_pool_error',
        errorName: error.name,
        message: error.message,
      });
    });

    this.connectionPromise = candidatePool
      .connect()
      .then((connectedPool) => {
        this.pool = connectedPool;

        this.logger.log({
          event: 'legacy_sql_server_pool_connected',

          database: this.configuration?.database,

          accessMode: 'READ_ONLY_APPLICATION_USAGE',
        });

        return connectedPool;
      })
      .catch((error: unknown) => {
        this.pool = null;
        this.connectionPromise = null;

        throw error;
      });

    return this.connectionPromise;
  }

  async ping(): Promise<void> {
    const pool = await this.getPool();

    await pool.request().query('SELECT 1 AS healthy;');
  }

  async onApplicationShutdown(): Promise<void> {
    const pendingConnection = this.connectionPromise;

    let poolToClose = this.pool;

    this.pool = null;
    this.connectionPromise = null;

    if (!poolToClose && pendingConnection) {
      try {
        poolToClose = await pendingConnection;
      } catch {
        return;
      }
    }

    if (!poolToClose) {
      return;
    }

    await poolToClose.close();

    this.logger.log({
      event: 'legacy_sql_server_pool_closed',
    });
  }

  private createConfiguration(): SqlServerConfig {
    return {
      server: this.configService.getOrThrow<string>('LEGACY_SQL_SERVER_HOST'),

      port: this.configService.getOrThrow<number>('LEGACY_SQL_SERVER_PORT'),

      database: this.configService.getOrThrow<string>(
        'LEGACY_SQL_SERVER_DATABASE',
      ),

      user: this.configService.getOrThrow<string>('LEGACY_SQL_SERVER_USERNAME'),

      password: this.configService.getOrThrow<string>(
        'LEGACY_SQL_SERVER_PASSWORD',
      ),

      connectionTimeout: this.configService.getOrThrow<number>(
        'LEGACY_SQL_SERVER_CONNECTION_TIMEOUT_MS',
      ),

      requestTimeout: this.configService.getOrThrow<number>(
        'LEGACY_SQL_SERVER_REQUEST_TIMEOUT_MS',
      ),

      pool: {
        max: this.configService.getOrThrow<number>(
          'LEGACY_SQL_SERVER_POOL_MAX',
        ),

        min: this.configService.getOrThrow<number>(
          'LEGACY_SQL_SERVER_POOL_MIN',
        ),

        idleTimeoutMillis: this.configService.getOrThrow<number>(
          'LEGACY_SQL_SERVER_POOL_IDLE_TIMEOUT_MS',
        ),
      },

      options: {
        encrypt: this.configService.getOrThrow<boolean>(
          'LEGACY_SQL_SERVER_ENCRYPT',
        ),

        trustServerCertificate: this.configService.getOrThrow<boolean>(
          'LEGACY_SQL_SERVER_TRUST_CERTIFICATE',
        ),

        enableArithAbort: true,
        useUTC: true,

        appName: 'telefonia-backend-legacy-read',
      },
    };
  }
}
