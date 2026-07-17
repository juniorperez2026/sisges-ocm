import type { Clock } from '../../../../shared/application/clock';
import { createAgentSessionNotFoundError } from '../errors/agent-session-not-found.error';
import type { AgentSessionRepository } from '../ports/agent-session.repository';
import {
  toAgentSessionView,
  type AgentSessionView,
} from '../views/agent-session.view';
import type { AgentStatus } from '../../domain/agent-status';
import { AgentStatusTransitionPolicy } from '../../domain/agent-status-transition.policy';

export interface ChangeAgentStatusCommand {
  readonly sessionId: string;
  readonly status: AgentStatus;
}

export class ChangeAgentStatusUseCase {
  constructor(
    private readonly repository: AgentSessionRepository,
    private readonly clock: Clock,
    private readonly transitionPolicy: AgentStatusTransitionPolicy,
  ) {}

  async execute(command: ChangeAgentStatusCommand): Promise<AgentSessionView> {
    const session = await this.repository.findById(command.sessionId);

    if (!session) {
      throw createAgentSessionNotFoundError(command.sessionId);
    }

    session.changeStatus(
      command.status,
      this.clock.now(),
      this.transitionPolicy,
    );

    await this.repository.save(session);

    return toAgentSessionView(session);
  }
}
