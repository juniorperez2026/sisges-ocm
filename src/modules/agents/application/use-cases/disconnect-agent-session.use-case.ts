import type { Clock } from '../../../../shared/application/clock';
import { createAgentSessionNotFoundError } from '../errors/agent-session-not-found.error';
import type { AgentSessionRepository } from '../ports/agent-session.repository';
import {
  toAgentSessionView,
  type AgentSessionView,
} from '../views/agent-session.view';

export class DisconnectAgentSessionUseCase {
  constructor(
    private readonly repository: AgentSessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(sessionId: string): Promise<AgentSessionView> {
    const session = await this.repository.findById(sessionId);

    if (!session) {
      throw createAgentSessionNotFoundError(sessionId);
    }

    session.disconnect(this.clock.now());

    await this.repository.save(session);

    return toAgentSessionView(session);
  }
}
