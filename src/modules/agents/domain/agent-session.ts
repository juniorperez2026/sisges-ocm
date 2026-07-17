import { DomainRuleViolationError } from '../../../shared/domain/domain-rule-violation.error';
import { AGENT_STATUS, type AgentStatus } from './agent-status';
import { AgentStatusTransitionPolicy } from './agent-status-transition.policy';

export interface StartAgentSessionInput {
  readonly id: string;
  readonly agentId: string;
  readonly extensionId: string;
  readonly connectedAt: Date;
}

export interface AgentSessionSnapshot {
  readonly id: string;
  readonly agentId: string;
  readonly extensionId: string;
  readonly status: AgentStatus;
  readonly connectedAt: Date;
  readonly disconnectedAt: Date | null;
  readonly lastStatusChangedAt: Date;
}

export class AgentSession {
  private constructor(
    private readonly idValue: string,
    private readonly agentIdValue: string,
    private readonly extensionIdValue: string,
    private statusValue: AgentStatus,
    private readonly connectedAtValue: Date,
    private disconnectedAtValue: Date | null,
    private lastStatusChangedAtValue: Date,
  ) {}

  static start(input: StartAgentSessionInput): AgentSession {
    const id = AgentSession.requireText(
      input.id,
      'INVALID_AGENT_SESSION_ID',
      'Agent session ID is required',
    );

    const agentId = AgentSession.requireText(
      input.agentId,
      'INVALID_AGENT_ID',
      'Agent ID is required',
    );

    const extensionId = AgentSession.requireText(
      input.extensionId,
      'INVALID_EXTENSION_ID',
      'Extension ID is required',
    );

    AgentSession.assertValidDate(
      input.connectedAt,
      'INVALID_CONNECTED_AT',
      'Connected date is invalid',
    );

    return new AgentSession(
      id,
      agentId,
      extensionId,
      AGENT_STATUS.OFFLINE,
      new Date(input.connectedAt),
      null,
      new Date(input.connectedAt),
    );
  }

  static rehydrate(snapshot: AgentSessionSnapshot): AgentSession {
    return new AgentSession(
      snapshot.id,
      snapshot.agentId,
      snapshot.extensionId,
      snapshot.status,
      new Date(snapshot.connectedAt),
      snapshot.disconnectedAt ? new Date(snapshot.disconnectedAt) : null,
      new Date(snapshot.lastStatusChangedAt),
    );
  }

  changeStatus(
    nextStatus: AgentStatus,
    changedAt: Date,
    transitionPolicy: AgentStatusTransitionPolicy,
  ): void {
    if (!this.isActive()) {
      throw new DomainRuleViolationError({
        code: 'AGENT_SESSION_ALREADY_DISCONNECTED',
        message: 'The status of a disconnected agent session cannot be changed',
        details: {
          sessionId: this.idValue,
        },
      });
    }

    AgentSession.assertValidDate(
      changedAt,
      'INVALID_STATUS_CHANGED_AT',
      'Status change date is invalid',
    );

    if (changedAt.getTime() < this.lastStatusChangedAtValue.getTime()) {
      throw new DomainRuleViolationError({
        code: 'AGENT_STATUS_DATE_OUT_OF_ORDER',
        message:
          'Agent status change date cannot be earlier than the previous change',
        details: {
          sessionId: this.idValue,
          previousChangedAt: this.lastStatusChangedAtValue.toISOString(),
          receivedChangedAt: changedAt.toISOString(),
        },
      });
    }

    transitionPolicy.assertTransition(this.statusValue, nextStatus);

    this.statusValue = nextStatus;
    this.lastStatusChangedAtValue = new Date(changedAt);
  }

  isActive(): boolean {
    return this.disconnectedAtValue === null;
  }

  get id(): string {
    return this.idValue;
  }

  get agentId(): string {
    return this.agentIdValue;
  }

  get extensionId(): string {
    return this.extensionIdValue;
  }

  get status(): AgentStatus {
    return this.statusValue;
  }

  get connectedAt(): Date {
    return new Date(this.connectedAtValue);
  }

  get disconnectedAt(): Date | null {
    return this.disconnectedAtValue ? new Date(this.disconnectedAtValue) : null;
  }

  get lastStatusChangedAt(): Date {
    return new Date(this.lastStatusChangedAtValue);
  }

  toSnapshot(): AgentSessionSnapshot {
    return {
      id: this.idValue,
      agentId: this.agentIdValue,
      extensionId: this.extensionIdValue,
      status: this.statusValue,
      connectedAt: new Date(this.connectedAtValue),
      disconnectedAt: this.disconnectedAtValue
        ? new Date(this.disconnectedAtValue)
        : null,
      lastStatusChangedAt: new Date(this.lastStatusChangedAtValue),
    };
  }

  private static requireText(
    value: string,
    code: string,
    message: string,
  ): string {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new DomainRuleViolationError({
        code,
        message,
      });
    }

    return normalizedValue;
  }

  private static assertValidDate(
    value: Date,
    code: string,
    message: string,
  ): void {
    if (Number.isNaN(value.getTime())) {
      throw new DomainRuleViolationError({
        code,
        message,
      });
    }
  }
}
