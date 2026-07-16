import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GlobalHttpExceptionFilter } from './shared/http/global-http-exception.filter';

function parseCorsOrigins(rawOrigins: string): string[] {
  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one valid origin');
  }

  return origins;
}

export function configureApplication(
  app: INestApplication,
  configService: ConfigService,
): void {
  const corsOrigins =
    configService.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173';

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: parseCorsOrigins(corsOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    exposedHeaders: ['X-Correlation-ID'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false,
    }),
  );

  app.useGlobalFilters(new GlobalHttpExceptionFilter());
}
