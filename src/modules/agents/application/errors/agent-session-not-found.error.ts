import {
  APPLICATION_ERROR_KIND,
  ApplicationError,
} from '../../../../shared/application/application.error';

export class AgentSessionNotFoundError extends ApplicationError {
  constructor(sessionId: string) {
    super({
      kind: APPLICATION_ERROR_KIND.NOT_FOUND,
      code: 'AGENT_SESSION_NOT_FOUND',
      message: 'Agent session was not found',
      details: {
        sessionId,
      },
    });

    this.name = AgentSessionNotFoundError.name;
  }
}

export function createAgentSessionNotFoundError(
  sessionId: string,
): AgentSessionNotFoundError {
  return new AgentSessionNotFoundError(sessionId);
}
