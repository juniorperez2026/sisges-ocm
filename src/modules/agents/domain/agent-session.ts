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
  readonly lastHeartbeatAt: Date;
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
    private lastHeartbeatAtValue: Date,
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

    const connectedAt = new Date(input.connectedAt);

    return new AgentSession(
      id,
      agentId,
      extensionId,
      AGENT_STATUS.OFFLINE,
      connectedAt,
      null,
      connectedAt,
      connectedAt,
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
      new Date(snapshot.lastHeartbeatAt),
    );
  }

  changeStatus(
    nextStatus: AgentStatus,
    changedAt: Date,
    transitionPolicy: AgentStatusTransitionPolicy,
  ): void {
    this.assertActive();

    AgentSession.assertValidDate(
      changedAt,
      'INVALID_STATUS_CHANGED_AT',
      'Status change date is invalid',
    );

    const latestKnownActivityAt = this.getLatestKnownActivityTimestamp();

    if (changedAt.getTime() < latestKnownActivityAt) {
      throw new DomainRuleViolationError({
        code: 'AGENT_STATUS_DATE_OUT_OF_ORDER',
        message:
          'Agent status change date cannot be earlier than the latest session activity',
        details: {
          sessionId: this.idValue,
          latestActivityAt: new Date(latestKnownActivityAt).toISOString(),
          receivedChangedAt: changedAt.toISOString(),
        },
      });
    }

    transitionPolicy.assertTransition(this.statusValue, nextStatus);

    this.statusValue = nextStatus;
    this.lastStatusChangedAtValue = new Date(changedAt);
  }

  recordHeartbeat(receivedAt: Date): void {
    this.assertActive();

    AgentSession.assertValidDate(
      receivedAt,
      'INVALID_HEARTBEAT_AT',
      'Heartbeat date is invalid',
    );

    const latestKnownActivityAt = this.getLatestKnownActivityTimestamp();

    if (receivedAt.getTime() < latestKnownActivityAt) {
      throw new DomainRuleViolationError({
        code: 'AGENT_HEARTBEAT_DATE_OUT_OF_ORDER',
        message:
          'Heartbeat date cannot be earlier than the latest session activity',
        details: {
          sessionId: this.idValue,
          latestActivityAt: new Date(latestKnownActivityAt).toISOString(),
          receivedHeartbeatAt: receivedAt.toISOString(),
        },
      });
    }

    this.lastHeartbeatAtValue = new Date(receivedAt);
  }

  disconnect(disconnectedAt: Date): void {
    this.assertActive();

    if (this.statusValue !== AGENT_STATUS.OFFLINE) {
      throw new DomainRuleViolationError({
        code: 'AGENT_SESSION_MUST_BE_OFFLINE_TO_DISCONNECT',
        message: 'Agent session must be OFFLINE before disconnecting',
        details: {
          sessionId: this.idValue,
          currentStatus: this.statusValue,
        },
      });
    }

    AgentSession.assertValidDate(
      disconnectedAt,
      'INVALID_DISCONNECTED_AT',
      'Disconnected date is invalid',
    );

    const latestKnownActivityAt = this.getLatestKnownActivityTimestamp();

    if (disconnectedAt.getTime() < latestKnownActivityAt) {
      throw new DomainRuleViolationError({
        code: 'AGENT_DISCONNECTION_DATE_OUT_OF_ORDER',
        message:
          'Disconnection date cannot be earlier than the latest session activity',
        details: {
          sessionId: this.idValue,
          latestActivityAt: new Date(latestKnownActivityAt).toISOString(),
          receivedDisconnectedAt: disconnectedAt.toISOString(),
        },
      });
    }

    this.disconnectedAtValue = new Date(disconnectedAt);
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

  get lastHeartbeatAt(): Date {
    return new Date(this.lastHeartbeatAtValue);
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
      lastHeartbeatAt: new Date(this.lastHeartbeatAtValue),
    };
  }

  private assertActive(): void {
    if (this.isActive()) {
      return;
    }

    throw new DomainRuleViolationError({
      code: 'AGENT_SESSION_ALREADY_DISCONNECTED',
      message: 'The disconnected agent session cannot be modified',
      details: {
        sessionId: this.idValue,
        disconnectedAt: this.disconnectedAtValue?.toISOString(),
      },
    });
  }

  private getLatestKnownActivityTimestamp(): number {
    return Math.max(
      this.connectedAtValue.getTime(),
      this.lastStatusChangedAtValue.getTime(),
      this.lastHeartbeatAtValue.getTime(),
    );
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
