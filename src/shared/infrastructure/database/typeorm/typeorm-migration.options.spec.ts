import { assertMigrationExecutionEnabled } from './migration-execution.guard';
import {
  createTypeOrmMigrationOptions,
  resolveTelephonyDatabaseIdentifiers,
} from './typeorm-migration.options';

const validEnvironment = {
  SQL_SERVER_HOST: 'sql-server.test',
  SQL_SERVER_PORT: '1433',
  SQL_SERVER_DATABASE: 'database_test',
  SQL_SERVER_USERNAME: 'user_test',
  SQL_SERVER_PASSWORD: 'password_test',

  SQL_SERVER_ENCRYPT: 'true',
  SQL_SERVER_TRUST_CERTIFICATE: 'true',

  SQL_SERVER_CONNECTION_TIMEOUT_MS: '10000',

  SQL_SERVER_REQUEST_TIMEOUT_MS: '15000',

  SQL_SERVER_POOL_MAX: '5',
  SQL_SERVER_POOL_MIN: '0',

  SQL_SERVER_POOL_IDLE_TIMEOUT_MS: '30000',

  SQL_SERVER_TELEPHONY_SCHEMA: 'telefonia',

  SQL_SERVER_MIGRATIONS_TABLE: 'migrations',

  SQL_SERVER_MIGRATIONS_ENABLED: 'false',
} as const;

describe('TypeORM migration configuration', () => {
  it('keeps destructive automation disabled', () => {
    const options = createTypeOrmMigrationOptions(validEnvironment);

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
    expect(options.dropSchema).toBe(false);
  });

  it('configures SQL Server without exposing schema ownership assumptions', () => {
    const options = createTypeOrmMigrationOptions(validEnvironment);

    expect(options).toMatchObject({
      type: 'mssql',
      host: 'sql-server.test',
      port: 1433,
      database: 'database_test',
      username: 'user_test',
      migrationsTableName: 'migrations',
    });

    expect(options).toMatchObject({
      type: 'mssql',
      host: 'sql-server.test',
      port: 1433,
      database: 'database_test',
      schema: 'telefonia',
      username: 'user_test',
      migrationsTableName: 'migrations',
    });
  });

  it('resolves safe telephony identifiers', () => {
    const identifiers = resolveTelephonyDatabaseIdentifiers(validEnvironment);

    expect(identifiers).toEqual({
      schema: 'telefonia',
      migrationsTable: 'migrations',
    });
  });

  it('rejects unsafe SQL identifiers', () => {
    expect(() =>
      resolveTelephonyDatabaseIdentifiers({
        ...validEnvironment,
        SQL_SERVER_TELEPHONY_SCHEMA: 'telefonia]; DROP TABLE users;--',
      }),
    ).toThrow('contains an invalid SQL identifier');
  });

  it('blocks migration execution by default', () => {
    expect(() => assertMigrationExecutionEnabled(validEnvironment)).toThrow(
      'Database migration execution is disabled',
    );
  });

  it('permits migration execution only after explicit enablement', () => {
    expect(() =>
      assertMigrationExecutionEnabled({
        ...validEnvironment,
        SQL_SERVER_MIGRATIONS_ENABLED: 'true',
      }),
    ).not.toThrow();
  });
});
