import {
  APPLICATION_ERROR_KIND,
  ApplicationError,
} from '../../../../shared/application/application.error';

export class ActiveAgentSessionExistsError extends ApplicationError {
  constructor(agentId: string, existingSessionId: string) {
    super({
      kind: APPLICATION_ERROR_KIND.CONFLICT,
      code: 'ACTIVE_AGENT_SESSION_EXISTS',
      message: 'Agent already has an active session',
      details: {
        agentId,
        existingSessionId,
      },
    });

    this.name = ActiveAgentSessionExistsError.name;
  }
}

export function createActiveAgentSessionExistsError(
  agentId: string,
  existingSessionId: string,
): ActiveAgentSessionExistsError {
  return new ActiveAgentSessionExistsError(agentId, existingSessionId);
}
