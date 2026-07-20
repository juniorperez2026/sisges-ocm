'use strict';

function environmentName(
  prefix,
  suffix,
) {
  return `${prefix}_${suffix}`;
}

function requireEnvironmentVariable(
  name,
) {
  const value =
    process.env[name]?.trim();

  if (
    !value ||
    value === 'change-this-value'
  ) {
    throw new Error(
      `Environment variable ${name} is not configured`,
    );
  }

  return value;
}

function readInteger(
  name,
  defaultValue,
) {
  const rawValue =
    process.env[name]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue =
    Number(rawValue);

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue < 0
  ) {
    throw new Error(
      `Environment variable ${name} must be a non-negative integer`,
    );
  }

  return parsedValue;
}

function readBoolean(
  name,
  defaultValue,
) {
  const rawValue =
    process.env[name]
      ?.trim()
      .toLowerCase();

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

function createSqlServerConfig(
  appName,
  prefix = 'SQL_SERVER',
) {
  return {
    server:
      requireEnvironmentVariable(
        environmentName(
          prefix,
          'HOST',
        ),
      ),

    port: readInteger(
      environmentName(
        prefix,
        'PORT',
      ),
      1433,
    ),

    database:
      requireEnvironmentVariable(
        environmentName(
          prefix,
          'DATABASE',
        ),
      ),

    user:
      requireEnvironmentVariable(
        environmentName(
          prefix,
          'USERNAME',
        ),
      ),

    password:
      requireEnvironmentVariable(
        environmentName(
          prefix,
          'PASSWORD',
        ),
      ),

    connectionTimeout:
      readInteger(
        environmentName(
          prefix,
          'CONNECTION_TIMEOUT_MS',
        ),
        10000,
      ),

    requestTimeout:
      readInteger(
        environmentName(
          prefix,
          'REQUEST_TIMEOUT_MS',
        ),
        15000,
      ),

    pool: {
      max: readInteger(
        environmentName(
          prefix,
          'POOL_MAX',
        ),
        5,
      ),

      min: readInteger(
        environmentName(
          prefix,
          'POOL_MIN',
        ),
        0,
      ),

      idleTimeoutMillis:
        readInteger(
          environmentName(
            prefix,
            'POOL_IDLE_TIMEOUT_MS',
          ),
          30000,
        ),
    },

    options: {
      encrypt: readBoolean(
        environmentName(
          prefix,
          'ENCRYPT',
        ),
        false,
      ),

      trustServerCertificate:
        readBoolean(
          environmentName(
            prefix,
            'TRUST_CERTIFICATE',
          ),
          true,
        ),

      appName,
      enableArithAbort: true,
      useUTC: true,
    },
  };
}

function resolveErrorDetails(
  error,
) {
  if (!(error instanceof Error)) {
    return {
      errorName:
        'UnknownError',
      message: String(error),
    };
  }

  return {
    errorName: error.name,
    message: error.message,

    code:
      typeof error.code ===
      'string'
        ? error.code
        : undefined,
  };
}

module.exports = {
  createSqlServerConfig,
  resolveErrorDetails,
};
