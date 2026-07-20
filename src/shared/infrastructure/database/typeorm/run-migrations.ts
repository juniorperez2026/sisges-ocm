import { assertMigrationExecutionEnabled } from './migration-execution.guard';
import { resolveTelephonyDatabaseIdentifiers } from './typeorm-migration.options';
import { typeOrmMigrationDataSource } from './typeorm-migration.data-source';

async function runMigrations(): Promise<void> {
  assertMigrationExecutionEnabled(process.env);

  const identifiers = resolveTelephonyDatabaseIdentifiers(process.env);

  try {
    await typeOrmMigrationDataSource.initialize();

    const queryRunner = typeOrmMigrationDataSource.createQueryRunner();

    try {
      /*
       * El nombre fue validado previamente como
       * identificador SQL seguro.
       *
       * TypeORM necesita que el esquema exista
       * antes de crear telefonia.migrations.
       */
      await queryRunner.createSchema(identifiers.schema, true);
    } finally {
      await queryRunner.release();
    }

    const executedMigrations = await typeOrmMigrationDataSource.runMigrations({
      transaction: 'all',
    });

    console.log(
      JSON.stringify(
        {
          migrated: true,

          schema: identifiers.schema,

          migrationsTable: `${identifiers.schema}.${identifiers.migrationsTable}`,

          executedCount: executedMigrations.length,

          migrations: executedMigrations.map((migration) => migration.name),
        },
        null,
        2,
      ),
    );
  } finally {
    if (typeOrmMigrationDataSource.isInitialized) {
      await typeOrmMigrationDataSource.destroy();
    }
  }
}

void runMigrations().catch((error: unknown) => {
  const details =
    error instanceof Error
      ? {
          errorName: error.name,
          message: error.message,
        }
      : {
          errorName: 'UnknownError',
          message: String(error),
        };

  console.error(
    JSON.stringify(
      {
        migrated: false,
        ...details,
      },
      null,
      2,
    ),
  );

  process.exitCode = 1;
});
