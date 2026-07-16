import * as Joi from 'joi';

const optionalText = Joi.string().trim().allow('').optional();

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

  SQL_SERVER_HOST: optionalText,
  SQL_SERVER_PORT: Joi.number().port().default(1433),
  SQL_SERVER_DATABASE: optionalText,
  SQL_SERVER_USERNAME: optionalText,
  SQL_SERVER_PASSWORD: optionalText,

  SQL_SERVER_ENCRYPT: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  SQL_SERVER_TRUST_CERTIFICATE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

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
