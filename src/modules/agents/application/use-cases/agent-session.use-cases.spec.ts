import type { Clock } from '../../../../shared/application/clock';
import type { IdGenerator } from '../../../../shared/application/id-generator';
import { DomainRuleViolationError } from '../../../../shared/domain/domain-rule-violation.error';
import { AGENT_STATUS } from '../../domain/agent-status';
import { AgentStatusTransitionPolicy } from '../../domain/agent-status-transition.policy';
import { InMemoryAgentSessionRepository } from '../../infrastructure/persistence/in-memory-agent-session.repository';
import { ActiveAgentSessionExistsError } from '../errors/active-agent-session-exists.error';
import { AgentSessionNotFoundError } from '../errors/agent-session-not-found.error';
import { ChangeAgentStatusUseCase } from './change-agent-status.use-case';
import { DisconnectAgentSessionUseCase } from './disconnect-agent-session.use-case';
import { GetAgentSessionUseCase } from './get-agent-session.use-case';
import { HeartbeatAgentSessionUseCase } from './heartbeat-agent-session.use-case';
import { StartAgentSessionUseCase } from './start-agent-session.use-case';

class MutableClock implements Clock {
  constructor(private value: Date) {}

  now(): Date {
    return new Date(this.value);
  }

  set(value: Date): void {
    this.value = new Date(value);
  }
}

class FixedIdGenerator implements IdGenerator {
  constructor(private readonly value: string) {}

  generate(): string {
    return this.value;
  }
}

describe('Agent session use cases', () => {
  const sessionId = 'c05c5705-6f0f-4bee-a835-7eb58fa67828';

  const connectedAt = new Date('2026-07-16T17:00:00.000Z');

  let repository: InMemoryAgentSessionRepository;

  let clock: MutableClock;

  let startUseCase: StartAgentSessionUseCase;

  let getUseCase: GetAgentSessionUseCase;

  let changeStatusUseCase: ChangeAgentStatusUseCase;

  let heartbeatUseCase: HeartbeatAgentSessionUseCase;

  let disconnectUseCase: DisconnectAgentSessionUseCase;

  beforeEach(() => {
    repository = new InMemoryAgentSessionRepository();

    clock = new MutableClock(connectedAt);

    startUseCase = new StartAgentSessionUseCase(
      repository,
      new FixedIdGenerator(sessionId),
      clock,
    );

    getUseCase = new GetAgentSessionUseCase(repository);

    changeStatusUseCase = new ChangeAgentStatusUseCase(
      repository,
      clock,
      new AgentStatusTransitionPolicy(),
    );

    heartbeatUseCase = new HeartbeatAgentSessionUseCase(repository, clock);

    disconnectUseCase = new DisconnectAgentSessionUseCase(repository, clock);
  });

  it('starts an agent session as OFFLINE', async () => {
    const result = await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    expect(result).toEqual({
      id: sessionId,
      agentId: 'agent-001',
      extensionId: '1001',
      status: AGENT_STATUS.OFFLINE,
      connectedAt: connectedAt.toISOString(),
      disconnectedAt: null,
      lastStatusChangedAt: connectedAt.toISOString(),
      lastHeartbeatAt: connectedAt.toISOString(),
    });
  });

  it('retrieves a previously created session', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    const result = await getUseCase.execute(sessionId);

    expect(result.id).toBe(sessionId);
    expect(result.status).toBe(AGENT_STATUS.OFFLINE);
  });

  it('rejects a second active session for an agent', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    await expect(
      startUseCase.execute({
        agentId: 'agent-001',
        extensionId: '1002',
      }),
    ).rejects.toBeInstanceOf(ActiveAgentSessionExistsError);
  });

  it('changes status using the domain policy', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    const result = await changeStatusUseCase.execute({
      sessionId,
      status: AGENT_STATUS.AVAILABLE,
    });

    expect(result.status).toBe(AGENT_STATUS.AVAILABLE);
  });

  it('rejects an invalid status transition', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    await expect(
      changeStatusUseCase.execute({
        sessionId,
        status: AGENT_STATUS.ON_CALL,
      }),
    ).rejects.toBeInstanceOf(DomainRuleViolationError);
  });

  it('updates the heartbeat of an active session', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    const heartbeatAt = new Date('2026-07-16T17:01:00.000Z');

    clock.set(heartbeatAt);

    const result = await heartbeatUseCase.execute(sessionId);

    expect(result.lastHeartbeatAt).toBe(heartbeatAt.toISOString());
  });

  it('disconnects an OFFLINE session', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    const disconnectedAt = new Date('2026-07-16T17:02:00.000Z');

    clock.set(disconnectedAt);

    const result = await disconnectUseCase.execute(sessionId);

    expect(result.disconnectedAt).toBe(disconnectedAt.toISOString());
  });

  it('rejects disconnection while agent is AVAILABLE', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    clock.set(new Date('2026-07-16T17:01:00.000Z'));

    await changeStatusUseCase.execute({
      sessionId,
      status: AGENT_STATUS.AVAILABLE,
    });

    clock.set(new Date('2026-07-16T17:02:00.000Z'));

    await expect(disconnectUseCase.execute(sessionId)).rejects.toMatchObject({
      code: 'AGENT_SESSION_MUST_BE_OFFLINE_TO_DISCONNECT',
    });
  });

  it('rejects heartbeat after disconnection', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    clock.set(new Date('2026-07-16T17:01:00.000Z'));

    await disconnectUseCase.execute(sessionId);

    clock.set(new Date('2026-07-16T17:02:00.000Z'));

    await expect(heartbeatUseCase.execute(sessionId)).rejects.toMatchObject({
      code: 'AGENT_SESSION_ALREADY_DISCONNECTED',
    });
  });

  it('allows a new session after the previous one disconnects', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1001',
    });

    clock.set(new Date('2026-07-16T17:01:00.000Z'));

    await disconnectUseCase.execute(sessionId);

    const secondStartUseCase = new StartAgentSessionUseCase(
      repository,
      new FixedIdGenerator('6bc597b1-2f63-4bd5-9b27-c9bc367e5278'),
      clock,
    );

    const secondSession = await secondStartUseCase.execute({
      agentId: 'agent-001',
      extensionId: '1002',
    });

    expect(secondSession.id).not.toBe(sessionId);

    expect(secondSession.status).toBe(AGENT_STATUS.OFFLINE);
  });

  it('reports an unknown session', async () => {
    await expect(getUseCase.execute(sessionId)).rejects.toBeInstanceOf(
      AgentSessionNotFoundError,
    );
  });
});
