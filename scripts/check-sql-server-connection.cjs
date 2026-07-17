'use strict';

const sql = require('mssql');

function requireEnvironmentVariable(name) {
  const value = process.env[name]?.trim();

  if (!value || value === 'change-this-value') {
    throw new Error(
      `Environment variable ${name} is not configured`,
    );
  }

  return value;
}

function readInteger(name, defaultValue) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 0
  ) {
    throw new Error(
      `Environment variable ${name} must be a non-negative integer`,
    );
  }

  return parsedValue;
}

function readBoolean(name, defaultValue) {
  const rawValue =
    process.env[name]?.trim().toLowerCase();

  if (!rawValue) {
    return defaultValue;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new Error(
    `Environment variable ${name} must be true or false`,
  );
}

function resolveErrorDetails(error) {
  if (!(error instanceof Error)) {
    return {
      errorName: 'UnknownError',
      message: String(error),
    };
  }

  return {
    errorName: error.name,
    message: error.message,
    code:
      typeof error.code === 'string'
        ? error.code
        : undefined,
  };
}

async function main() {
  const configuration = {
    server: requireEnvironmentVariable(
      'SQL_SERVER_HOST',
    ),
    port: readInteger(
      'SQL_SERVER_PORT',
      1433,
    ),
    database: requireEnvironmentVariable(
      'SQL_SERVER_DATABASE',
    ),
    user: requireEnvironmentVariable(
      'SQL_SERVER_USERNAME',
    ),
    password: requireEnvironmentVariable(
      'SQL_SERVER_PASSWORD',
    ),
    connectionTimeout: readInteger(
      'SQL_SERVER_CONNECTION_TIMEOUT_MS',
      10000,
    ),
    requestTimeout: readInteger(
      'SQL_SERVER_REQUEST_TIMEOUT_MS',
      15000,
    ),
    pool: {
      max: readInteger(
        'SQL_SERVER_POOL_MAX',
        5,
      ),
      min: readInteger(
        'SQL_SERVER_POOL_MIN',
        0,
      ),
      idleTimeoutMillis: readInteger(
        'SQL_SERVER_POOL_IDLE_TIMEOUT_MS',
        30000,
      ),
    },
    options: {
      encrypt: readBoolean(
        'SQL_SERVER_ENCRYPT',
        false,
      ),
      trustServerCertificate: readBoolean(
        'SQL_SERVER_TRUST_CERTIFICATE',
        true,
      ),
      appName: 'telefonia-backend-connectivity-check',
      enableArithAbort: true,
    },
  };

  let connectionPool;

  try {
    connectionPool =
      await new sql.ConnectionPool(
        configuration,
      ).connect();

    const result =
      await connectionPool.request().query(`
        SELECT
          CAST(
            SERVERPROPERTY('ServerName')
            AS nvarchar(256)
          ) AS serverName,

          CAST(
            SERVERPROPERTY('ProductVersion')
            AS nvarchar(128)
          ) AS productVersion,

          CAST(
            SERVERPROPERTY('ProductLevel')
            AS nvarchar(128)
          ) AS productLevel,

          CAST(
            SERVERPROPERTY('Edition')
            AS nvarchar(256)
          ) AS edition,

          DB_NAME() AS databaseName,
          SUSER_SNAME() AS loginName,
          USER_NAME() AS databaseUser,
          SCHEMA_NAME() AS defaultSchema,
          @@SPID AS sessionId;
      `);

    const connectionInformation =
      result.recordset[0];

    console.log(
      JSON.stringify(
        {
          connected: true,
          connection: connectionInformation,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          connected: false,
          error: resolveErrorDetails(error),
        },
        null,
        2,
      ),
    );

    process.exitCode = 1;
  } finally {
    if (connectionPool) {
      await connectionPool.close();
    }
  }
}

void main();
