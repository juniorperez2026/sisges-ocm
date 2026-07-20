import {
  APPLICATION_ERROR_KIND,
  ApplicationError,
} from '../../../../shared/application/application.error';

export class AgentSessionNotAvailableError extends ApplicationError {
  constructor(sessionId: string, currentStatus: string) {
    super({
      kind: APPLICATION_ERROR_KIND.CONFLICT,

      code: 'AGENT_SESSION_NOT_AVAILABLE',

      message: 'Agent session must be active and AVAILABLE to prepare a call',

      details: {
        sessionId,
        currentStatus,
      },
    });

    this.name = AgentSessionNotAvailableError.name;
  }
}

export function createAgentSessionNotAvailableError(
  sessionId: string,
  currentStatus: string,
): AgentSessionNotAvailableError {
  return new AgentSessionNotAvailableError(sessionId, currentStatus);
}

export class CallablePhoneNotFoundError extends ApplicationError {
  constructor(debtorId: string, sourcePhoneId: string) {
    super({
      kind: APPLICATION_ERROR_KIND.NOT_FOUND,

      code: 'CALLABLE_PHONE_NOT_FOUND',

      message: 'The selected phone does not exist or is not callable',

      details: {
        debtorId,
        sourcePhoneId,
      },
    });

    this.name = CallablePhoneNotFoundError.name;
  }
}

export function createCallablePhoneNotFoundError(
  debtorId: string,
  sourcePhoneId: string,
): CallablePhoneNotFoundError {
  return new CallablePhoneNotFoundError(debtorId, sourcePhoneId);
}

export class ActiveCallExistsError extends ApplicationError {
  constructor(agentSessionId: string, existingCallId?: string) {
    super({
      kind: APPLICATION_ERROR_KIND.CONFLICT,

      code: 'ACTIVE_CALL_EXISTS',

      message: 'Agent session already has an active call',

      details: {
        agentSessionId,
        existingCallId,
      },
    });

    this.name = ActiveCallExistsError.name;
  }
}

export function createActiveCallExistsError(
  agentSessionId: string,
  existingCallId?: string,
): ActiveCallExistsError {
  return new ActiveCallExistsError(agentSessionId, existingCallId);
}

export class CallNotFoundError extends ApplicationError {
  constructor(callId: string) {
    super({
      kind: APPLICATION_ERROR_KIND.NOT_FOUND,

      code: 'CALL_NOT_FOUND',

      message: 'Call was not found',

      details: {
        callId,
      },
    });

    this.name = CallNotFoundError.name;
  }
}

export function createCallNotFoundError(callId: string): CallNotFoundError {
  return new CallNotFoundError(callId);
}

export class CallConcurrencyError extends ApplicationError {
  constructor(callId: string) {
    super({
      kind: APPLICATION_ERROR_KIND.CONFLICT,

      code: 'CALL_CONCURRENT_MODIFICATION',

      message: 'Call was modified by another operation',

      details: {
        callId,
      },
    });

    this.name = CallConcurrencyError.name;
  }
}

export function createCallConcurrencyError(
  callId: string,
): CallConcurrencyError {
  return new CallConcurrencyError(callId);
}
