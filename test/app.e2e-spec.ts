import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';

interface LivenessResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}

interface ReadinessResponse {
  status: string;
}

interface ErrorResponse {
  statusCode: number;
  code: string;
  correlationId: string;
  path: string;
}

describe('Application foundation (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    configureApplication(app, app.get(ConfigService));

    await app.init();

    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health/live returns liveness status', async () => {
    const response = await request(httpServer)
      .get('/api/health/live')
      .expect(200);

    const body = response.body as LivenessResponse;

    expect(body.status).toBe('ok');
    expect(body.service).toBe('telefonia-backend');
    expect(body.version).toBe('0.1.0');
    expect(body.timestamp).toEqual(expect.any(String));
    expect(body.uptimeSeconds).toEqual(expect.any(Number));

    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
  });

  it('GET /api/health/ready returns readiness status', async () => {
    const response = await request(httpServer)
      .get('/api/health/ready')
      .expect(200);

    const body = response.body as ReadinessResponse;

    expect(body.status).toBe('ok');
  });

  it('preserves a valid incoming correlation ID', async () => {
    const correlationId = 'e2e-correlation-001';

    await request(httpServer)
      .get('/api/health/live')
      .set('x-correlation-id', correlationId)
      .expect('x-correlation-id', correlationId)
      .expect(200);
  });

  it('returns a standardized error response', async () => {
    const correlationId = 'e2e-error-001';

    const response = await request(httpServer)
      .get('/api/non-existing-route')
      .set('x-correlation-id', correlationId)
      .expect('x-correlation-id', correlationId)
      .expect(404);

    const body = response.body as ErrorResponse;

    expect(body.statusCode).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.correlationId).toBe(correlationId);
    expect(body.path).toBe('/api/non-existing-route');
  });
});
