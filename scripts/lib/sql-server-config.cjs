'use strict';

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

function createSqlServerConfig(appName) {
  return {
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

      appName,
      enableArithAbort: true,
    },
  };
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

module.exports = {
  createSqlServerConfig,
  resolveErrorDetails,
};
