'use strict';

const sql = require('mssql');

const {
  createSqlServerConfig,
  resolveErrorDetails,
} = require('./lib/sql-server-config.cjs');

const EXPECTED_TABLES = [
  'agentes',
  'extensiones',
  'migrations',
  'sesiones_agente',
];

const EXPECTED_MIGRATION =
  'CreateAgentSessionPersistence1784520000000';

function requireEnvironmentVariable(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Environment variable ${name} is not configured`,
    );
  }

  return value;
}

function assertCleanupEnabled() {
  if (
    process.env
      .LEGACY_TELEPHONY_CLEANUP_ENABLED !==
    'true'
  ) {
    throw new Error(
      [
        'Legacy telephony cleanup is disabled.',
        'No database objects were removed.',
        'Set LEGACY_TELEPHONY_CLEANUP_ENABLED=true only for the controlled cleanup.',
      ].join(' '),
    );
  }
}

function compareStringArrays(left, right) {
  return (
    left.length === right.length &&
    left.every(
      (value, index) =>
        value === right[index],
    )
  );
}

async function main() {
  assertCleanupEnabled();

  const expectedDatabase =
    requireEnvironmentVariable(
      'LEGACY_TELEPHONY_CLEANUP_EXPECTED_DATABASE',
    );

  const configuredDatabase =
    requireEnvironmentVariable(
      'LEGACY_SQL_SERVER_DATABASE',
    );

  if (
    configuredDatabase !==
    expectedDatabase
  ) {
    throw new Error(
      [
        'Legacy cleanup database mismatch.',
        `Configured: ${configuredDatabase}.`,
        `Expected: ${expectedDatabase}.`,
        'No changes were applied.',
      ].join(' '),
    );
  }

  let pool;

  try {
    pool =
      await new sql.ConnectionPool(
        createSqlServerConfig(
          'telefonia-backend-controlled-legacy-cleanup',
          'LEGACY_SQL_SERVER',
        ),
      ).connect();

    const connectionResult =
      await pool.request().query(`
        SELECT
          CAST(
            SERVERPROPERTY('ServerName')
            AS nvarchar(256)
          ) AS serverName,

          DB_NAME() AS databaseName,

          SUSER_SNAME() AS loginName,

          USER_NAME() AS databaseUser;
      `);

    const connection =
      connectionResult.recordset[0];

    if (
      connection.databaseName !==
      expectedDatabase
    ) {
      throw new Error(
        [
          'Connected database does not match the authorized cleanup database.',
          `Connected: ${connection.databaseName}.`,
          `Expected: ${expectedDatabase}.`,
          'No changes were applied.',
        ].join(' '),
      );
    }

    const schemaResult =
      await pool.request().query(`
        SELECT
          CASE
            WHEN SCHEMA_ID(N'telefonia')
              IS NULL
              THEN 0
            ELSE 1
          END AS schemaExists;
      `);

    const schemaExists =
      schemaResult.recordset[0]
        .schemaExists === 1;

    if (!schemaExists) {
      console.log(
        JSON.stringify(
          {
            cleaned: true,
            changed: false,
            reason:
              'The telefonia schema does not exist in the legacy database.',
            connection,
          },
          null,
          2,
        ),
      );

      return;
    }

    const tablesResult =
      await pool.request().query(`
        SELECT
          tableObject.name AS tableName

        FROM sys.tables AS tableObject

        INNER JOIN sys.schemas AS schemaObject
          ON schemaObject.schema_id =
            tableObject.schema_id

        WHERE schemaObject.name =
          N'telefonia'

        ORDER BY tableObject.name;
      `);

    const actualTables =
      tablesResult.recordset.map(
        (row) => row.tableName,
      );

    if (
      !compareStringArrays(
        actualTables,
        EXPECTED_TABLES,
      )
    ) {
      throw new Error(
        [
          'The telefonia schema contains an unexpected set of tables.',
          `Expected: ${EXPECTED_TABLES.join(', ')}.`,
          `Found: ${actualTables.join(', ')}.`,
          'No changes were applied.',
        ].join(' '),
      );
    }

    const rowCountResult =
      await pool.request().query(`
        SELECT
          (
            SELECT COUNT_BIG(*)
            FROM [telefonia].[agentes]
          ) AS agentCount,

          (
            SELECT COUNT_BIG(*)
            FROM [telefonia].[extensiones]
          ) AS extensionCount,

          (
            SELECT COUNT_BIG(*)
            FROM [telefonia].[sesiones_agente]
          ) AS sessionCount,

          (
            SELECT COUNT_BIG(*)
            FROM [telefonia].[migrations]
          ) AS migrationCount;
      `);

    const rowCounts =
      rowCountResult.recordset[0];

    if (
      Number(rowCounts.agentCount) !== 0 ||
      Number(rowCounts.extensionCount) !==
        0 ||
      Number(rowCounts.sessionCount) !== 0
    ) {
      throw new Error(
        [
          'The accidental telephony tables contain application data.',
          `Agents: ${rowCounts.agentCount}.`,
          `Extensions: ${rowCounts.extensionCount}.`,
          `Sessions: ${rowCounts.sessionCount}.`,
          'Automatic cleanup was cancelled.',
        ].join(' '),
      );
    }

    const migrationResult =
      await pool.request().query(`
        SELECT
          [id],
          [timestamp],
          [name]

        FROM [telefonia].[migrations]

        ORDER BY [id];
      `);

    const unexpectedMigrations =
      migrationResult.recordset.filter(
        (migration) =>
          migration.name !==
          EXPECTED_MIGRATION,
      );

    if (
      unexpectedMigrations.length > 0
    ) {
      throw new Error(
        [
          'Unexpected migrations were found in the legacy telefonia schema.',
          'Automatic cleanup was cancelled.',
        ].join(' '),
      );
    }

    const transaction =
      new sql.Transaction(pool);

    await transaction.begin(
      sql.ISOLATION_LEVEL.SERIALIZABLE,
    );

    try {
      const request =
        new sql.Request(transaction);

      await request.batch(`
        DROP TABLE
          [telefonia].[sesiones_agente];

        DROP TABLE
          [telefonia].[extensiones];

        DROP TABLE
          [telefonia].[agentes];

        DROP TABLE
          [telefonia].[migrations];

        IF EXISTS (
          SELECT 1
          FROM sys.schemas
          WHERE name = N'telefonia'
        )
        BEGIN
          DROP SCHEMA [telefonia];
        END;
      `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    console.log(
      JSON.stringify(
        {
          cleaned: true,
          changed: true,
          connection,
          removedSchema: 'telefonia',
          removedTables:
            EXPECTED_TABLES,
          removedApplicationRows: {
            agents:
              Number(
                rowCounts.agentCount,
              ),
            extensions:
              Number(
                rowCounts.extensionCount,
              ),
            sessions:
              Number(
                rowCounts.sessionCount,
              ),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        cleaned: false,
        error:
          resolveErrorDetails(error),
      },
      null,
      2,
    ),
  );

  process.exitCode = 1;
});
