import { ConsoleLogger, type LogLevel, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';

const LOG_LEVELS: readonly LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
];

function resolveLogLevels(configuredLevel: LogLevel): LogLevel[] {
  const levelIndex = LOG_LEVELS.indexOf(configuredLevel);

  if (levelIndex < 0) {
    return ['fatal', 'error', 'warn', 'log'];
  }

  return LOG_LEVELS.slice(0, levelIndex + 1);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  const environment = configService.getOrThrow<string>('NODE_ENV');

  const port = configService.getOrThrow<number>('PORT');

  const appName = configService.getOrThrow<string>('APP_NAME');

  const configuredLogLevel = configService.getOrThrow<LogLevel>('LOG_LEVEL');

  app.useLogger(
    new ConsoleLogger({
      json: environment === 'production',
      colors: environment !== 'production',
      logLevels: resolveLogLevels(configuredLogLevel),
    }),
  );

  configureApplication(app, configService);

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');

  logger.log({
    event: 'application_started',
    application: appName,
    environment,
    port,
  });
}

void bootstrap().catch((error: unknown) => {
  const errorDetails =
    error instanceof Error
      ? {
          errorName: error.name,
          message: error.message,
          stack: error.stack,
        }
      : {
          errorName: 'UnknownError',
          message: String(error),
        };

  console.error(
    JSON.stringify({
      level: 'fatal',
      timestamp: new Date().toISOString(),
      event: 'application_bootstrap_failed',
      ...errorDetails,
    }),
  );

  process.exitCode = 1;
});
