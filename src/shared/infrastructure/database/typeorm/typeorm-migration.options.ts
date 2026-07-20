import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import {
  type EnvironmentSource,
  readEnvironmentBoolean,
  readEnvironmentInteger,
  readSqlIdentifier,
  requireEnvironmentValue,
} from './typeorm-environment.utils';

export interface TelephonyDatabaseIdentifiers {
  readonly schema: string;
  readonly migrationsTable: string;
}

export function resolveTelephonyDatabaseIdentifiers(
  environment: EnvironmentSource,
): TelephonyDatabaseIdentifiers {
  return {
    schema: readSqlIdentifier(
      environment,
      'SQL_SERVER_TELEPHONY_SCHEMA',
      'telefonia',
    ),

    migrationsTable: readSqlIdentifier(
      environment,
      'SQL_SERVER_MIGRATIONS_TABLE',
      'migrations',
    ),
  };
}

export function createTypeOrmMigrationOptions(
  environment: EnvironmentSource,
): DataSourceOptions {
  const identifiers = resolveTelephonyDatabaseIdentifiers(environment);

  return {
    type: 'mssql',

    host: requireEnvironmentValue(environment, 'SQL_SERVER_HOST'),

    port: readEnvironmentInteger(environment, 'SQL_SERVER_PORT', 1433),

    database: requireEnvironmentValue(environment, 'SQL_SERVER_DATABASE'),

    schema: identifiers.schema,

    username: requireEnvironmentValue(environment, 'SQL_SERVER_USERNAME'),

    password: requireEnvironmentValue(environment, 'SQL_SERVER_PASSWORD'),

    connectionTimeout: readEnvironmentInteger(
      environment,
      'SQL_SERVER_CONNECTION_TIMEOUT_MS',
      10000,
    ),

    requestTimeout: readEnvironmentInteger(
      environment,
      'SQL_SERVER_REQUEST_TIMEOUT_MS',
      15000,
    ),

    pool: {
      max: readEnvironmentInteger(environment, 'SQL_SERVER_POOL_MAX', 5),

      min: readEnvironmentInteger(environment, 'SQL_SERVER_POOL_MIN', 0),

      idleTimeoutMillis: readEnvironmentInteger(
        environment,
        'SQL_SERVER_POOL_IDLE_TIMEOUT_MS',
        30000,
      ),
    },

    options: {
      encrypt: readEnvironmentBoolean(environment, 'SQL_SERVER_ENCRYPT', false),

      trustServerCertificate: readEnvironmentBoolean(
        environment,
        'SQL_SERVER_TRUST_CERTIFICATE',
        true,
      ),

      enableArithAbort: true,
      useUTC: true,
      appName: 'telefonia-backend-migrations',
    },

    entities: [],

    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],

    migrationsTableName: identifiers.migrationsTable,

    synchronize: false,
    migrationsRun: false,
    dropSchema: false,

    migrationsTransactionMode: 'all',

    logging: ['error', 'warn', 'migration'],
  };
}
