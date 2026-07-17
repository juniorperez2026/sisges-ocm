import type { AgentSession } from '../../domain/agent-session';

export const AGENT_SESSION_REPOSITORY = Symbol('AGENT_SESSION_REPOSITORY');

export interface AgentSessionRepository {
  findById(sessionId: string): Promise<AgentSession | null>;

  findActiveByAgentId(agentId: string): Promise<AgentSession | null>;

  save(session: AgentSession): Promise<void>;
}
