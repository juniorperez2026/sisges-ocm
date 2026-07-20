import {
  APPLICATION_ERROR_KIND,
  ApplicationError,
} from '../../../../shared/application/application.error';

export class AgentSessionPersistenceConflictError extends ApplicationError {
  constructor(agentId: string, extensionId: string) {
    super({
      kind: APPLICATION_ERROR_KIND.CONFLICT,

      code: 'AGENT_SESSION_PERSISTENCE_CONFLICT',

      message: 'The agent or extension already has an active session',

      details: {
        agentId,
        extensionId,
      },
    });

    this.name = AgentSessionPersistenceConflictError.name;
  }
}

export function createAgentSessionPersistenceConflictError(
  agentId: string,
  extensionId: string,
): AgentSessionPersistenceConflictError {
  return new AgentSessionPersistenceConflictError(agentId, extensionId);
}
