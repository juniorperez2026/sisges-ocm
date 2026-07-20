import { Injectable } from '@nestjs/common';
import { createActiveCallExistsError } from '../../application/errors/call.errors';
import type { CallRepository } from '../../application/ports/call.repository';
import { Call, type CallSnapshot } from '../../domain/call';

@Injectable()
export class InMemoryCallRepository implements CallRepository {
  private readonly calls = new Map<string, CallSnapshot>();

  findById(callId: string): Promise<Call | null> {
    const snapshot = this.calls.get(callId);

    return Promise.resolve(snapshot ? Call.rehydrate(snapshot) : null);
  }

  findActiveByAgentSessionId(agentSessionId: string): Promise<Call | null> {
    for (const snapshot of this.calls.values()) {
      if (
        snapshot.agentSessionId === agentSessionId &&
        snapshot.endedAt === null
      ) {
        return Promise.resolve(Call.rehydrate(snapshot));
      }
    }

    return Promise.resolve(null);
  }

  save(call: Call): Promise<void> {
    if (call.isActive()) {
      for (const snapshot of this.calls.values()) {
        if (
          snapshot.id !== call.id &&
          snapshot.agentSessionId === call.agentSessionId &&
          snapshot.endedAt === null
        ) {
          throw createActiveCallExistsError(call.agentSessionId, snapshot.id);
        }
      }
    }

    call.markPersisted(call.version + 1);

    this.calls.set(call.id, call.toSnapshot());

    return Promise.resolve();
  }
}
