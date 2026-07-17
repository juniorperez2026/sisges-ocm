import type { Clock } from '../../../../shared/application/clock';
import type { IdGenerator } from '../../../../shared/application/id-generator';
import { createActiveAgentSessionExistsError } from '../errors/active-agent-session-exists.error';
import type { AgentSessionRepository } from '../ports/agent-session.repository';
import {
  toAgentSessionView,
  type AgentSessionView,
} from '../views/agent-session.view';
import { AgentSession } from '../../domain/agent-session';

export interface StartAgentSessionCommand {
  readonly agentId: string;
  readonly extensionId: string;
}

export class StartAgentSessionUseCase {
  constructor(
    private readonly repository: AgentSessionRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: StartAgentSessionCommand): Promise<AgentSessionView> {
    const normalizedAgentId = command.agentId.trim();

    const existingSession =
      await this.repository.findActiveByAgentId(normalizedAgentId);

    if (existingSession) {
      throw createActiveAgentSessionExistsError(
        normalizedAgentId,
        existingSession.id,
      );
    }

    const session = AgentSession.start({
      id: this.idGenerator.generate(),
      agentId: normalizedAgentId,
      extensionId: command.extensionId,
      connectedAt: this.clock.now(),
    });

    await this.repository.save(session);

    return toAgentSessionView(session);
  }
}
