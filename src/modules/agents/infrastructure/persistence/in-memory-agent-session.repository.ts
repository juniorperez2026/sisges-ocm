import { Injectable } from '@nestjs/common';
import type { AgentSessionRepository } from '../../application/ports/agent-session.repository';
import {
  AgentSession,
  type AgentSessionSnapshot,
} from '../../domain/agent-session';

@Injectable()
export class InMemoryAgentSessionRepository implements AgentSessionRepository {
  private readonly sessions = new Map<string, AgentSessionSnapshot>();

  findById(sessionId: string): Promise<AgentSession | null> {
    const snapshot = this.sessions.get(sessionId);

    return Promise.resolve(snapshot ? AgentSession.rehydrate(snapshot) : null);
  }

  findActiveByAgentId(agentId: string): Promise<AgentSession | null> {
    for (const snapshot of this.sessions.values()) {
      if (snapshot.agentId === agentId && snapshot.disconnectedAt === null) {
        return Promise.resolve(AgentSession.rehydrate(snapshot));
      }
    }

    return Promise.resolve(null);
  }

  save(session: AgentSession): Promise<void> {
    this.sessions.set(session.id, session.toSnapshot());

    return Promise.resolve();
  }

  clear(): void {
    this.sessions.clear();
  }
}
