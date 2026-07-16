import { DomainRuleViolationError } from '../../../shared/domain/domain-rule-violation.error';
import { CALL_STATUS, type CallStatus } from './call-status';

const CALL_STATUS_TRANSITIONS: Readonly<
  Record<CallStatus, readonly CallStatus[]>
> = {
  [CALL_STATUS.CREATED]: [
    CALL_STATUS.CONNECTING,
    CALL_STATUS.CANCELLED,
    CALL_STATUS.FAILED,
  ],

  [CALL_STATUS.CONNECTING]: [
    CALL_STATUS.DIALING,
    CALL_STATUS.RINGING,
    CALL_STATUS.ANSWERED,
    CALL_STATUS.CANCELLED,
    CALL_STATUS.FAILED,
  ],

  [CALL_STATUS.DIALING]: [
    CALL_STATUS.RINGING,
    CALL_STATUS.ANSWERED,
    CALL_STATUS.BUSY,
    CALL_STATUS.NO_ANSWER,
    CALL_STATUS.REJECTED,
    CALL_STATUS.CANCELLED,
    CALL_STATUS.FAILED,
  ],

  [CALL_STATUS.RINGING]: [
    CALL_STATUS.ANSWERED,
    CALL_STATUS.BUSY,
    CALL_STATUS.NO_ANSWER,
    CALL_STATUS.REJECTED,
    CALL_STATUS.CANCELLED,
    CALL_STATUS.FAILED,
  ],

  [CALL_STATUS.ANSWERED]: [
    CALL_STATUS.ENDING,
    CALL_STATUS.ENDED,
    CALL_STATUS.FAILED,
  ],

  [CALL_STATUS.ENDING]: [CALL_STATUS.ENDED, CALL_STATUS.FAILED],

  [CALL_STATUS.ENDED]: [],
  [CALL_STATUS.FAILED]: [],
  [CALL_STATUS.BUSY]: [],
  [CALL_STATUS.NO_ANSWER]: [],
  [CALL_STATUS.REJECTED]: [],
  [CALL_STATUS.CANCELLED]: [],
};

const TERMINAL_CALL_STATUSES: ReadonlySet<CallStatus> = new Set<CallStatus>([
  CALL_STATUS.ENDED,
  CALL_STATUS.FAILED,
  CALL_STATUS.BUSY,
  CALL_STATUS.NO_ANSWER,
  CALL_STATUS.REJECTED,
  CALL_STATUS.CANCELLED,
]);

export class CallStatusTransitionPolicy {
  canTransition(currentStatus: CallStatus, nextStatus: CallStatus): boolean {
    return CALL_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
  }

  assertTransition(currentStatus: CallStatus, nextStatus: CallStatus): void {
    if (this.canTransition(currentStatus, nextStatus)) {
      return;
    }

    throw new DomainRuleViolationError({
      code: 'INVALID_CALL_STATUS_TRANSITION',
      message:
        `Call status cannot transition ` +
        `from ${currentStatus} to ${nextStatus}`,
      details: {
        currentStatus,
        nextStatus,
        allowedTransitions: this.getAllowedTransitions(currentStatus),
      },
    });
  }

  getAllowedTransitions(currentStatus: CallStatus): readonly CallStatus[] {
    return [...CALL_STATUS_TRANSITIONS[currentStatus]];
  }

  isTerminal(status: CallStatus): boolean {
    return TERMINAL_CALL_STATUSES.has(status);
  }
}
