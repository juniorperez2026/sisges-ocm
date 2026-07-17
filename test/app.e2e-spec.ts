import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';

interface LivenessResponse {
  readonly status: string;
  readonly service: string;
  readonly version: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

interface ReadinessResponse {
  readonly status: string;
}

interface AgentSessionResponse {
  readonly id: string;
  readonly agentId: string;
  readonly extensionId: string;
  readonly status: string;
  readonly connectedAt: string;
  readonly disconnectedAt: string | null;
  readonly lastStatusChangedAt: string;
  readonly lastHeartbeatAt: string;
}

interface ErrorResponse {
  readonly statusCode: number;
  readonly code: string;
  readonly correlationId: string;
  readonly path: string;
  readonly details?: Readonly<Record<string, unknown>>;
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
    extensionId = 'extension-1001',
  ): Promise<AgentSessionResponse> {
    const response = await request(httpServer)
      .post('/api/agent-sessions')
      .send({
        agentId,
        extensionId,
      })
      .expect(201);

    return response.body as AgentSessionResponse;
  }

  describe('Health', () => {
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
  });

  describe('HTTP foundation', () => {
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

  describe('Agent sessions', () => {
    it('creates an agent session', async () => {
      const session = await createAgentSession();

      expect(session.id).toEqual(expect.any(String));
      expect(session.agentId).toEqual(expect.any(String));
      expect(session.extensionId).toBe('extension-1001');
      expect(session.status).toBe('OFFLINE');
      expect(session.connectedAt).toEqual(expect.any(String));
      expect(session.lastStatusChangedAt).toEqual(expect.any(String));
      expect(session.lastHeartbeatAt).toEqual(expect.any(String));
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

      expect(result.id).toBe(created.id);
      expect(result.status).toBe('AVAILABLE');
      expect(Date.parse(result.lastStatusChangedAt)).toBeGreaterThanOrEqual(
        Date.parse(created.lastStatusChangedAt),
      );
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

      await createAgentSession(agentId, 'extension-1001');

      const response = await request(httpServer)
        .post('/api/agent-sessions')
        .send({
          agentId,
          extensionId: 'extension-1002',
        })
        .expect(409);

      const body = response.body as ErrorResponse;

      expect(body.code).toBe('ACTIVE_AGENT_SESSION_EXISTS');

      expect(body.details).toMatchObject({
        agentId,
      });
    });

    it('returns 404 for an unknown agent session', async () => {
      const unknownSessionId = randomUUID();

      const response = await request(httpServer)
        .get(`/api/agent-sessions/${unknownSessionId}`)
        .expect(404);

      const body = response.body as ErrorResponse;

      expect(body.code).toBe('AGENT_SESSION_NOT_FOUND');

      expect(body.details).toMatchObject({
        sessionId: unknownSessionId,
      });
    });

    it('updates the heartbeat of an active agent session', async () => {
      const created = await createAgentSession();

      const response = await request(httpServer)
        .post(`/api/agent-sessions/${created.id}/heartbeat`)
        .expect(200);

      const result = response.body as AgentSessionResponse;

      expect(result.id).toBe(created.id);
      expect(result.status).toBe('OFFLINE');

      expect(Date.parse(result.lastHeartbeatAt)).toBeGreaterThanOrEqual(
        Date.parse(created.lastHeartbeatAt),
      );
    });

    it('disconnects an OFFLINE agent session', async () => {
      const agentId = `agent-${randomUUID()}`;

      const created = await createAgentSession(agentId);

      const response = await request(httpServer)
        .post(`/api/agent-sessions/${created.id}/disconnect`)
        .expect(200);

      const result = response.body as AgentSessionResponse;

      expect(result.id).toBe(created.id);
      expect(result.status).toBe('OFFLINE');
      expect(result.disconnectedAt).toEqual(expect.any(String));

      const secondSession = await createAgentSession(agentId, 'extension-1002');

      expect(secondSession.id).not.toBe(created.id);
      expect(secondSession.agentId).toBe(agentId);
      expect(secondSession.extensionId).toBe('extension-1002');
      expect(secondSession.status).toBe('OFFLINE');
    });

    it('rejects disconnection while agent is AVAILABLE', async () => {
      const created = await createAgentSession();

      await request(httpServer)
        .patch(`/api/agent-sessions/${created.id}/status`)
        .send({
          status: 'AVAILABLE',
        })
        .expect(200);

      const response = await request(httpServer)
        .post(`/api/agent-sessions/${created.id}/disconnect`)
        .expect(409);

      const body = response.body as ErrorResponse;

      expect(body.code).toBe('AGENT_SESSION_MUST_BE_OFFLINE_TO_DISCONNECT');

      expect(body.details).toMatchObject({
        sessionId: created.id,
        currentStatus: 'AVAILABLE',
      });
    });

    it('rejects heartbeat after disconnection', async () => {
      const created = await createAgentSession();

      await request(httpServer)
        .post(`/api/agent-sessions/${created.id}/disconnect`)
        .expect(200);

      const response = await request(httpServer)
        .post(`/api/agent-sessions/${created.id}/heartbeat`)
        .expect(409);

      const body = response.body as ErrorResponse;

      expect(body.code).toBe('AGENT_SESSION_ALREADY_DISCONNECTED');

      expect(body.details).toMatchObject({
        sessionId: created.id,
      });
    });
  });
});
