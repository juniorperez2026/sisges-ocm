import {
  APPLICATION_ERROR_KIND,
  ApplicationError,
} from '../../../../shared/application/application.error';

export class AgentSessionConcurrencyError extends ApplicationError {
  constructor(sessionId: string) {
    super({
      kind: APPLICATION_ERROR_KIND.CONFLICT,

      code: 'AGENT_SESSION_CONCURRENT_MODIFICATION',

      message: 'The agent session was modified by another operation',

      details: {
        sessionId,
      },
    });

    this.name = AgentSessionConcurrencyError.name;
  }
}

export function createAgentSessionConcurrencyError(
  sessionId: string,
): AgentSessionConcurrencyError {
  return new AgentSessionConcurrencyError(sessionId);
}
