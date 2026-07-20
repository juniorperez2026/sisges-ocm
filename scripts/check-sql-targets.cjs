'use strict';

const sql = require('mssql');

const {
  createSqlServerConfig,
  resolveErrorDetails,
} = require(
  './lib/sql-server-config.cjs',
);

async function inspectTarget(
  label,
  prefix,
) {
  let pool;

  try {
    pool = await new sql.ConnectionPool(
      createSqlServerConfig(
        `telefonia-backend-check-${label}`,
        prefix,
      ),
    ).connect();

    const information =
      await pool.request().query(`
        SELECT
          CAST(
            SERVERPROPERTY('ServerName')
            AS nvarchar(256)
          ) AS serverName,

          DB_NAME() AS databaseName,

          SUSER_SNAME()
            AS loginName,

          USER_NAME()
            AS databaseUser,

          CASE
            WHEN SCHEMA_ID(
              N'telefonia'
            ) IS NULL
              THEN 0
            ELSE 1
          END AS telephonySchemaExists;
      `);

    const objects =
      await pool.request().query(`
        SELECT
          objectObject.name
            AS objectName,

          objectObject.type_desc
            AS objectType

        FROM sys.objects
          AS objectObject

        INNER JOIN sys.schemas
          AS schemaObject
          ON schemaObject.schema_id =
            objectObject.schema_id

        WHERE
          schemaObject.name =
            N'telefonia'

          AND objectObject
            .is_ms_shipped = 0

        ORDER BY
          objectObject.type_desc,
          objectObject.name;
      `);

    return {
      label,
      connected: true,

      connection:
        information.recordset[0],

      telephonyObjects:
        objects.recordset,
    };
  } catch (error) {
    return {
      label,
      connected: false,
      error:
        resolveErrorDetails(
          error,
        ),
    };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

async function main() {
  const results =
    await Promise.all([
      inspectTarget(
        'TELEPHONY_DATABASE',
        'SQL_SERVER',
      ),

      inspectTarget(
        'LEGACY_PHONE_SOURCE',
        'LEGACY_SQL_SERVER',
      ),
    ]);

  console.log(
    JSON.stringify(
      {
        inspected: true,
        results,
      },
      null,
      2,
    ),
  );

  if (
    results.some(
      (result) =>
        !result.connected,
    )
  ) {
    process.exitCode = 1;
  }
}

void main();
