import {
  type EnvironmentSource,
  readEnvironmentBoolean,
} from './typeorm-environment.utils';

export function assertMigrationExecutionEnabled(
  environment: EnvironmentSource,
): void {
  const enabled = readEnvironmentBoolean(
    environment,
    'SQL_SERVER_MIGRATIONS_ENABLED',
    false,
  );

  if (enabled) {
    return;
  }

  throw new Error(
    [
      'Database migration execution is disabled.',
      'No database changes were applied.',
      'Set SQL_SERVER_MIGRATIONS_ENABLED=true only after explicit approval.',
    ].join(' '),
  );
}
