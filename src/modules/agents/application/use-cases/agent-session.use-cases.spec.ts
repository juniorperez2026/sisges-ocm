import type { Clock } from '../../../../shared/application/clock';
import type { IdGenerator } from '../../../../shared/application/id-generator';
import { DomainRuleViolationError } from '../../../../shared/domain/domain-rule-violation.error';
import { AGENT_STATUS } from '../../domain/agent-status';
import { AgentStatusTransitionPolicy } from '../../domain/agent-status-transition.policy';
import { InMemoryAgentSessionRepository } from '../../infrastructure/persistence/in-memory-agent-session.repository';
import { ActiveAgentSessionExistsError } from '../errors/active-agent-session-exists.error';
import { AgentSessionNotFoundError } from '../errors/agent-session-not-found.error';
import { ChangeAgentStatusUseCase } from './change-agent-status.use-case';
import { GetAgentSessionUseCase } from './get-agent-session.use-case';
import { StartAgentSessionUseCase } from './start-agent-session.use-case';

class FixedClock implements Clock {
  constructor(private readonly value: Date) {}

  now(): Date {
    return new Date(this.value);
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

  const now = new Date('2026-07-16T17:00:00.000Z');

  let repository: InMemoryAgentSessionRepository;

  let startUseCase: StartAgentSessionUseCase;

  let getUseCase: GetAgentSessionUseCase;

  let changeStatusUseCase: ChangeAgentStatusUseCase;

  beforeEach(() => {
    repository = new InMemoryAgentSessionRepository();

    const clock = new FixedClock(now);

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
  });

  it('starts an agent session as OFFLINE', async () => {
    const result = await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: 'extension-1001',
    });

    expect(result).toEqual({
      id: sessionId,
      agentId: 'agent-001',
      extensionId: 'extension-1001',
      status: AGENT_STATUS.OFFLINE,
      connectedAt: now.toISOString(),
      disconnectedAt: null,
      lastStatusChangedAt: now.toISOString(),
    });
  });

  it('retrieves a previously created session', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: 'extension-1001',
    });

    const result = await getUseCase.execute(sessionId);

    expect(result.id).toBe(sessionId);
    expect(result.status).toBe(AGENT_STATUS.OFFLINE);
  });

  it('rejects a second active session for an agent', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: 'extension-1001',
    });

    await expect(
      startUseCase.execute({
        agentId: 'agent-001',
        extensionId: 'extension-1002',
      }),
    ).rejects.toBeInstanceOf(ActiveAgentSessionExistsError);
  });

  it('changes status using the domain policy', async () => {
    await startUseCase.execute({
      agentId: 'agent-001',
      extensionId: 'extension-1001',
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
      extensionId: 'extension-1001',
    });

    await expect(
      changeStatusUseCase.execute({
        sessionId,
        status: AGENT_STATUS.ON_CALL,
      }),
    ).rejects.toBeInstanceOf(DomainRuleViolationError);
  });

  it('reports an unknown session', async () => {
    await expect(getUseCase.execute(sessionId)).rejects.toBeInstanceOf(
      AgentSessionNotFoundError,
    );
  });
});
