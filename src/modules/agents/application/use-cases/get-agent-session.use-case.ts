import { createAgentSessionNotFoundError } from '../errors/agent-session-not-found.error';
import type { AgentSessionRepository } from '../ports/agent-session.repository';
import {
  toAgentSessionView,
  type AgentSessionView,
} from '../views/agent-session.view';

export class GetAgentSessionUseCase {
  constructor(private readonly repository: AgentSessionRepository) {}

  async execute(sessionId: string): Promise<AgentSessionView> {
    const session = await this.repository.findById(sessionId);

    if (!session) {
      throw createAgentSessionNotFoundError(sessionId);
    }

    return toAgentSessionView(session);
  }
}
