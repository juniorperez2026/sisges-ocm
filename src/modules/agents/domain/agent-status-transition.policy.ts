import { DomainRuleViolationError } from '../../../shared/domain/domain-rule-violation.error';
import { AGENT_STATUS, type AgentStatus } from './agent-status';

const AGENT_STATUS_TRANSITIONS: Readonly<
  Record<AgentStatus, readonly AgentStatus[]>
> = {
  [AGENT_STATUS.OFFLINE]: [AGENT_STATUS.AVAILABLE],

  [AGENT_STATUS.AVAILABLE]: [
    AGENT_STATUS.DIALING,
    AGENT_STATUS.PAUSED,
    AGENT_STATUS.OFFLINE,
    AGENT_STATUS.ERROR,
  ],

  [AGENT_STATUS.DIALING]: [
    AGENT_STATUS.ON_CALL,
    AGENT_STATUS.WRAP_UP,
    AGENT_STATUS.ERROR,
  ],

  [AGENT_STATUS.ON_CALL]: [AGENT_STATUS.WRAP_UP, AGENT_STATUS.ERROR],

  [AGENT_STATUS.WRAP_UP]: [
    AGENT_STATUS.AVAILABLE,
    AGENT_STATUS.PAUSED,
    AGENT_STATUS.OFFLINE,
    AGENT_STATUS.ERROR,
  ],

  [AGENT_STATUS.PAUSED]: [
    AGENT_STATUS.AVAILABLE,
    AGENT_STATUS.OFFLINE,
    AGENT_STATUS.ERROR,
  ],

  [AGENT_STATUS.ERROR]: [AGENT_STATUS.OFFLINE],
};

export class AgentStatusTransitionPolicy {
  canTransition(currentStatus: AgentStatus, nextStatus: AgentStatus): boolean {
    return AGENT_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
  }

  assertTransition(currentStatus: AgentStatus, nextStatus: AgentStatus): void {
    if (this.canTransition(currentStatus, nextStatus)) {
      return;
    }

    throw new DomainRuleViolationError({
      code: 'INVALID_AGENT_STATUS_TRANSITION',
      message:
        `Agent status cannot transition ` +
        `from ${currentStatus} to ${nextStatus}`,
      details: {
        currentStatus,
        nextStatus,
        allowedTransitions: this.getAllowedTransitions(currentStatus),
      },
    });
  }

  getAllowedTransitions(currentStatus: AgentStatus): readonly AgentStatus[] {
    return [...AGENT_STATUS_TRANSITIONS[currentStatus]];
  }
}
