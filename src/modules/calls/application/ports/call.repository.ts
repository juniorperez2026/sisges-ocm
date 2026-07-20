import type { Call } from '../../domain/call';

export const CALL_REPOSITORY = Symbol('CALL_REPOSITORY');

export interface CallRepository {
  findById(callId: string): Promise<Call | null>;

  findActiveByAgentSessionId(agentSessionId: string): Promise<Call | null>;

  save(call: Call): Promise<void>;
}
