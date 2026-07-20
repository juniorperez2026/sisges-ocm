import { Injectable } from '@nestjs/common';
import {
  AgentSession,
  type AgentSessionSnapshot,
} from '../../domain/agent-session';
import type { AgentSessionRepository } from '../../application/ports/agent-session.repository';

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
    session.markPersisted(session.version + 1);

    this.sessions.set(session.id, session.toSnapshot());

    return Promise.resolve();
  }
}
