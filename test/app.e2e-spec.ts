import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
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

interface AgentSessionResponse {
  id: string;
  agentId: string;
  extensionId: string;
  status: string;
  connectedAt: string;
  disconnectedAt: string | null;
  lastStatusChangedAt: string;
}

interface ErrorResponse {
  statusCode: number;
  code: string;
  correlationId: string;
  path: string;
  details?: Record<string, unknown>;
}

describe('Application (e2e)', () => {
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

  async function createAgentSession(
    agentId = `agent-${randomUUID()}`,
  ): Promise<AgentSessionResponse> {
    const response = await request(httpServer)
      .post('/api/agent-sessions')
      .send({
        agentId,
        extensionId: 'extension-1001',
      })
      .expect(201);

    return response.body as AgentSessionResponse;
  }

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

  it('creates an agent session', async () => {
    const session = await createAgentSession();

    expect(session.id).toEqual(expect.any(String));
    expect(session.status).toBe('OFFLINE');
    expect(session.disconnectedAt).toBeNull();
  });

  it('retrieves an agent session', async () => {
    const created = await createAgentSession();

    const response = await request(httpServer)
      .get(`/api/agent-sessions/${created.id}`)
      .expect(200);

    const result = response.body as AgentSessionResponse;

    expect(result).toEqual(created);
  });

  it('changes agent status from OFFLINE to AVAILABLE', async () => {
    const created = await createAgentSession();

    const response = await request(httpServer)
      .patch(`/api/agent-sessions/${created.id}/status`)
      .send({
        status: 'AVAILABLE',
      })
      .expect(200);

    const result = response.body as AgentSessionResponse;

    expect(result.status).toBe('AVAILABLE');
  });

  it('rejects an invalid agent status transition', async () => {
    const created = await createAgentSession();

    const response = await request(httpServer)
      .patch(`/api/agent-sessions/${created.id}/status`)
      .send({
        status: 'ON_CALL',
      })
      .expect(409);

    const body = response.body as ErrorResponse;

    expect(body.code).toBe('INVALID_AGENT_STATUS_TRANSITION');

    expect(body.details).toMatchObject({
      currentStatus: 'OFFLINE',
      nextStatus: 'ON_CALL',
    });
  });

  it('rejects a second active session for the same agent', async () => {
    const agentId = `agent-${randomUUID()}`;

    await createAgentSession(agentId);

    const response = await request(httpServer)
      .post('/api/agent-sessions')
      .send({
        agentId,
        extensionId: 'extension-1002',
      })
      .expect(409);

    const body = response.body as ErrorResponse;

    expect(body.code).toBe('ACTIVE_AGENT_SESSION_EXISTS');
  });

  it('returns 404 for an unknown agent session', async () => {
    const unknownSessionId = randomUUID();

    const response = await request(httpServer)
      .get(`/api/agent-sessions/${unknownSessionId}`)
      .expect(404);

    const body = response.body as ErrorResponse;

    expect(body.code).toBe('AGENT_SESSION_NOT_FOUND');
  });
});
