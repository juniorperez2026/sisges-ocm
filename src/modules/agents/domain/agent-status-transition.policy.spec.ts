import { DomainRuleViolationError } from '../../../shared/domain/domain-rule-violation.error';
import { AGENT_STATUS, type AgentStatus } from './agent-status';
import { AgentStatusTransitionPolicy } from './agent-status-transition.policy';

describe('AgentStatusTransitionPolicy', () => {
  let policy: AgentStatusTransitionPolicy;

  beforeEach(() => {
    policy = new AgentStatusTransitionPolicy();
  });

  it('allows the normal call lifecycle', () => {
    const transitions: ReadonlyArray<readonly [AgentStatus, AgentStatus]> = [
      [AGENT_STATUS.OFFLINE, AGENT_STATUS.AVAILABLE],
      [AGENT_STATUS.AVAILABLE, AGENT_STATUS.DIALING],
      [AGENT_STATUS.DIALING, AGENT_STATUS.ON_CALL],
      [AGENT_STATUS.ON_CALL, AGENT_STATUS.WRAP_UP],
      [AGENT_STATUS.WRAP_UP, AGENT_STATUS.AVAILABLE],
    ];

    for (const [currentStatus, nextStatus] of transitions) {
      expect(policy.canTransition(currentStatus, nextStatus)).toBe(true);

      expect(() =>
        policy.assertTransition(currentStatus, nextStatus),
      ).not.toThrow();
    }
  });

  it('allows pausing and resuming an available agent', () => {
    expect(
      policy.canTransition(AGENT_STATUS.AVAILABLE, AGENT_STATUS.PAUSED),
    ).toBe(true);

    expect(
      policy.canTransition(AGENT_STATUS.PAUSED, AGENT_STATUS.AVAILABLE),
    ).toBe(true);
  });

  it('rejects an invalid transition', () => {
    let capturedError: unknown;

    try {
      policy.assertTransition(AGENT_STATUS.OFFLINE, AGENT_STATUS.ON_CALL);
    } catch (error: unknown) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(DomainRuleViolationError);

    if (!(capturedError instanceof DomainRuleViolationError)) {
      throw new Error('Expected DomainRuleViolationError');
    }

    expect(capturedError.code).toBe('INVALID_AGENT_STATUS_TRANSITION');

    expect(capturedError.details).toEqual({
      currentStatus: AGENT_STATUS.OFFLINE,
      nextStatus: AGENT_STATUS.ON_CALL,
      allowedTransitions: [AGENT_STATUS.AVAILABLE],
    });
  });

  it('rejects a transition to the current status', () => {
    expect(
      policy.canTransition(AGENT_STATUS.AVAILABLE, AGENT_STATUS.AVAILABLE),
    ).toBe(false);
  });
});
