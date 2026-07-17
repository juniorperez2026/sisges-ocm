import * as Joi from 'joi';

const optionalText = Joi.string().trim().allow('').optional();

const requiredSqlServerText = Joi.string()
  .trim()
  .min(1)
  .invalid('change-this-value')
  .when('SQL_SERVER_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: optionalText,
  });

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  APP_NAME: Joi.string().trim().min(1).default('telefonia-backend'),

  APP_VERSION: Joi.string().trim().min(1).default('0.1.0'),

  CORS_ORIGINS: Joi.string().trim().min(1).default('http://localhost:5173'),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'log', 'debug', 'verbose')
    .default('debug'),

  JWT_SECRET: optionalText,

  JWT_EXPIRES_IN: Joi.string().trim().default('15m'),

  SQL_SERVER_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  SQL_SERVER_HOST: requiredSqlServerText,

  SQL_SERVER_PORT: Joi.number().port().default(1433),

  SQL_SERVER_DATABASE: requiredSqlServerText,

  SQL_SERVER_USERNAME: requiredSqlServerText,

  SQL_SERVER_PASSWORD: requiredSqlServerText,

  SQL_SERVER_ENCRYPT: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  SQL_SERVER_TRUST_CERTIFICATE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  SQL_SERVER_CONNECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(10000),

  SQL_SERVER_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(15000),

  SQL_SERVER_POOL_MAX: Joi.number().integer().min(1).default(5),

  SQL_SERVER_POOL_MIN: Joi.number().integer().min(0).default(0),

  SQL_SERVER_POOL_IDLE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(30000),

  ASTERISK_ARI_URL: Joi.alternatives()
    .try(
      Joi.string().uri({
        scheme: ['http', 'https'],
      }),
      Joi.string().valid(''),
    )
    .optional(),

  ASTERISK_ARI_USERNAME: optionalText,

  ASTERISK_ARI_PASSWORD: optionalText,

  ASTERISK_APP_NAME: Joi.string().trim().default('telefonia-backend'),
});
