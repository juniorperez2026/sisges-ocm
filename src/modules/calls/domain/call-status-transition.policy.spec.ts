import { DomainRuleViolationError } from '../../../shared/domain/domain-rule-violation.error';
import { CALL_STATUS, type CallStatus } from './call-status';
import { CallStatusTransitionPolicy } from './call-status-transition.policy';

describe('CallStatusTransitionPolicy', () => {
  let policy: CallStatusTransitionPolicy;

  beforeEach(() => {
    policy = new CallStatusTransitionPolicy();
  });

  it('allows the normal answered-call lifecycle', () => {
    const transitions: ReadonlyArray<readonly [CallStatus, CallStatus]> = [
      [CALL_STATUS.CREATED, CALL_STATUS.CONNECTING],
      [CALL_STATUS.CONNECTING, CALL_STATUS.DIALING],
      [CALL_STATUS.DIALING, CALL_STATUS.RINGING],
      [CALL_STATUS.RINGING, CALL_STATUS.ANSWERED],
      [CALL_STATUS.ANSWERED, CALL_STATUS.ENDING],
      [CALL_STATUS.ENDING, CALL_STATUS.ENDED],
    ];

    for (const [currentStatus, nextStatus] of transitions) {
      expect(policy.canTransition(currentStatus, nextStatus)).toBe(true);

      expect(() =>
        policy.assertTransition(currentStatus, nextStatus),
      ).not.toThrow();
    }
  });

  it('supports unsuccessful dialing outcomes', () => {
    const outcomes: readonly CallStatus[] = [
      CALL_STATUS.BUSY,
      CALL_STATUS.NO_ANSWER,
      CALL_STATUS.REJECTED,
      CALL_STATUS.CANCELLED,
      CALL_STATUS.FAILED,
    ];

    for (const outcome of outcomes) {
      expect(policy.canTransition(CALL_STATUS.RINGING, outcome)).toBe(true);
    }
  });

  it('marks final call statuses as terminal', () => {
    const terminalStatuses: readonly CallStatus[] = [
      CALL_STATUS.ENDED,
      CALL_STATUS.FAILED,
      CALL_STATUS.BUSY,
      CALL_STATUS.NO_ANSWER,
      CALL_STATUS.REJECTED,
      CALL_STATUS.CANCELLED,
    ];

    for (const status of terminalStatuses) {
      expect(policy.isTerminal(status)).toBe(true);
      expect(policy.getAllowedTransitions(status)).toEqual([]);
    }

    expect(policy.isTerminal(CALL_STATUS.ANSWERED)).toBe(false);
  });

  it('rejects returning an answered call to ringing', () => {
    let capturedError: unknown;

    try {
      policy.assertTransition(CALL_STATUS.ANSWERED, CALL_STATUS.RINGING);
    } catch (error: unknown) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(DomainRuleViolationError);

    if (!(capturedError instanceof DomainRuleViolationError)) {
      throw new Error('Expected DomainRuleViolationError');
    }

    expect(capturedError.code).toBe('INVALID_CALL_STATUS_TRANSITION');

    expect(capturedError.details).toEqual({
      currentStatus: CALL_STATUS.ANSWERED,
      nextStatus: CALL_STATUS.RINGING,
      allowedTransitions: [
        CALL_STATUS.ENDING,
        CALL_STATUS.ENDED,
        CALL_STATUS.FAILED,
      ],
    });
  });
});
