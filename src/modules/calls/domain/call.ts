import { DomainRuleViolationError } from '../../../shared/domain/domain-rule-violation.error';
import { CALL_STATUS, type CallStatus } from './call-status';
import { CallStatusTransitionPolicy } from './call-status-transition.policy';

export const CALL_PHONE_KIND = {
  MOBILE: 'MOBILE',
  FIXED: 'FIXED',
} as const;

export type CallPhoneKind =
  (typeof CALL_PHONE_KIND)[keyof typeof CALL_PHONE_KIND];

const TERMINAL_CALL_STATUSES = new Set<CallStatus>([
  CALL_STATUS.ENDED,
  CALL_STATUS.FAILED,
  CALL_STATUS.BUSY,
  CALL_STATUS.NO_ANSWER,
  CALL_STATUS.REJECTED,
  CALL_STATUS.CANCELLED,
]);

export interface StartCallInput {
  readonly id: string;
  readonly agentSessionId: string;

  readonly sourcePhoneId: string;
  readonly debtorId: string;
  readonly contractId: string | null;

  readonly dialedE164Number: string;
  readonly dialedNationalNumber: string;
  readonly phoneKind: CallPhoneKind;

  readonly createdAt: Date;
}

export interface CallStatusChange {
  readonly previousStatus: CallStatus | null;

  readonly nextStatus: CallStatus;

  readonly changedAt: Date;
}

export interface CallSnapshot {
  readonly id: string;
  readonly agentSessionId: string;

  readonly sourcePhoneId: string;
  readonly debtorId: string;
  readonly contractId: string | null;

  readonly dialedE164Number: string;
  readonly dialedNationalNumber: string;
  readonly phoneKind: CallPhoneKind;

  readonly status: CallStatus;

  readonly asteriskChannelId: string | null;

  readonly asteriskBridgeId: string | null;

  readonly createdAt: Date;
  readonly lastStatusChangedAt: Date;

  readonly dialingAt: Date | null;
  readonly ringingAt: Date | null;
  readonly answeredAt: Date | null;
  readonly endedAt: Date | null;

  readonly terminationReason: string | null;

  readonly version: number;
}

export class Call {
  private pendingStatusChangeValue: CallStatusChange | null;

  private constructor(
    private readonly idValue: string,

    private readonly agentSessionIdValue: string,

    private readonly sourcePhoneIdValue: string,

    private readonly debtorIdValue: string,

    private readonly contractIdValue: string | null,

    private readonly dialedE164NumberValue: string,

    private readonly dialedNationalNumberValue: string,

    private readonly phoneKindValue: CallPhoneKind,

    private statusValue: CallStatus,

    private asteriskChannelIdValue: string | null,

    private asteriskBridgeIdValue: string | null,

    private readonly createdAtValue: Date,

    private lastStatusChangedAtValue: Date,

    private dialingAtValue: Date | null,

    private ringingAtValue: Date | null,

    private answeredAtValue: Date | null,

    private endedAtValue: Date | null,

    private terminationReasonValue: string | null,

    private versionValue: number,

    pendingStatusChange: CallStatusChange | null,
  ) {
    this.pendingStatusChangeValue = pendingStatusChange;
  }

  static start(input: StartCallInput): Call {
    const id = Call.requireText(
      input.id,
      'INVALID_CALL_ID',
      'Call ID is required',
    );

    const agentSessionId = Call.requireText(
      input.agentSessionId,
      'INVALID_CALL_AGENT_SESSION_ID',
      'Agent session ID is required',
    );

    const sourcePhoneId = Call.requireText(
      input.sourcePhoneId,
      'INVALID_CALL_SOURCE_PHONE_ID',
      'Source phone ID is required',
    );

    const debtorId = Call.requireText(
      input.debtorId,
      'INVALID_CALL_DEBTOR_ID',
      'Debtor ID is required',
    );

    const e164Number = Call.requireText(
      input.dialedE164Number,
      'INVALID_CALL_E164_NUMBER',
      'E.164 phone number is required',
    );

    const nationalNumber = Call.requireText(
      input.dialedNationalNumber,
      'INVALID_CALL_NATIONAL_NUMBER',
      'National phone number is required',
    );

    Call.assertValidDate(
      input.createdAt,
      'INVALID_CALL_CREATED_AT',
      'Call creation date is invalid',
    );

    const createdAt = new Date(input.createdAt);

    return new Call(
      id,
      agentSessionId,
      sourcePhoneId,
      debtorId,
      input.contractId,
      e164Number,
      nationalNumber,
      input.phoneKind,
      CALL_STATUS.CREATED,
      null,
      null,
      createdAt,
      createdAt,
      null,
      null,
      null,
      null,
      null,
      0,
      {
        previousStatus: null,
        nextStatus: CALL_STATUS.CREATED,
        changedAt: createdAt,
      },
    );
  }

  static rehydrate(snapshot: CallSnapshot): Call {
    if (!Number.isSafeInteger(snapshot.version) || snapshot.version <= 0) {
      throw new DomainRuleViolationError({
        code: 'INVALID_CALL_VERSION',

        message: 'Call version is invalid',

        details: {
          callId: snapshot.id,
          version: snapshot.version,
        },
      });
    }

    return new Call(
      snapshot.id,
      snapshot.agentSessionId,
      snapshot.sourcePhoneId,
      snapshot.debtorId,
      snapshot.contractId,
      snapshot.dialedE164Number,
      snapshot.dialedNationalNumber,
      snapshot.phoneKind,
      snapshot.status,
      snapshot.asteriskChannelId,
      snapshot.asteriskBridgeId,
      new Date(snapshot.createdAt),
      new Date(snapshot.lastStatusChangedAt),
      snapshot.dialingAt ? new Date(snapshot.dialingAt) : null,
      snapshot.ringingAt ? new Date(snapshot.ringingAt) : null,
      snapshot.answeredAt ? new Date(snapshot.answeredAt) : null,
      snapshot.endedAt ? new Date(snapshot.endedAt) : null,
      snapshot.terminationReason,
      snapshot.version,
      null,
    );
  }

  changeStatus(
    nextStatus: CallStatus,
    changedAt: Date,
    policy: CallStatusTransitionPolicy,
    terminationReason: string | null = null,
  ): void {
    if (this.pendingStatusChangeValue) {
      throw new DomainRuleViolationError({
        code: 'CALL_HAS_UNPERSISTED_STATUS_CHANGE',

        message: 'Call already has an unpersisted status change',

        details: {
          callId: this.idValue,
        },
      });
    }

    Call.assertValidDate(
      changedAt,
      'INVALID_CALL_STATUS_CHANGED_AT',
      'Call status change date is invalid',
    );

    if (changedAt.getTime() < this.lastStatusChangedAtValue.getTime()) {
      throw new DomainRuleViolationError({
        code: 'CALL_STATUS_DATE_OUT_OF_ORDER',

        message:
          'Call status date cannot be earlier than the previous status date',

        details: {
          callId: this.idValue,

          previousChangedAt: this.lastStatusChangedAtValue.toISOString(),

          receivedChangedAt: changedAt.toISOString(),
        },
      });
    }

    const previousStatus = this.statusValue;

    policy.assertTransition(previousStatus, nextStatus);

    this.statusValue = nextStatus;

    this.lastStatusChangedAtValue = new Date(changedAt);

    if (nextStatus === CALL_STATUS.DIALING) {
      this.dialingAtValue = new Date(changedAt);
    }

    if (nextStatus === CALL_STATUS.RINGING) {
      this.ringingAtValue = new Date(changedAt);
    }

    if (nextStatus === CALL_STATUS.ANSWERED) {
      this.answeredAtValue = new Date(changedAt);
    }

    if (TERMINAL_CALL_STATUSES.has(nextStatus)) {
      this.endedAtValue = new Date(changedAt);

      this.terminationReasonValue = terminationReason;
    }

    this.pendingStatusChangeValue = {
      previousStatus,
      nextStatus,
      changedAt: new Date(changedAt),
    };
  }

  markPersisted(nextVersion: number): void {
    if (
      !Number.isSafeInteger(nextVersion) ||
      nextVersion <= this.versionValue
    ) {
      throw new DomainRuleViolationError({
        code: 'INVALID_CALL_PERSISTED_VERSION',

        message:
          'Persisted call version must be greater than the current version',

        details: {
          callId: this.idValue,

          currentVersion: this.versionValue,

          nextVersion,
        },
      });
    }

    this.versionValue = nextVersion;

    this.pendingStatusChangeValue = null;
  }

  getPendingStatusChange(): CallStatusChange | null {
    if (!this.pendingStatusChangeValue) {
      return null;
    }

    return {
      previousStatus: this.pendingStatusChangeValue.previousStatus,

      nextStatus: this.pendingStatusChangeValue.nextStatus,

      changedAt: new Date(this.pendingStatusChangeValue.changedAt),
    };
  }

  isActive(): boolean {
    return this.endedAtValue === null;
  }

  get id(): string {
    return this.idValue;
  }

  get agentSessionId(): string {
    return this.agentSessionIdValue;
  }

  get sourcePhoneId(): string {
    return this.sourcePhoneIdValue;
  }

  get debtorId(): string {
    return this.debtorIdValue;
  }

  get contractId(): string | null {
    return this.contractIdValue;
  }

  get dialedE164Number(): string {
    return this.dialedE164NumberValue;
  }

  get dialedNationalNumber(): string {
    return this.dialedNationalNumberValue;
  }

  get phoneKind(): CallPhoneKind {
    return this.phoneKindValue;
  }

  get status(): CallStatus {
    return this.statusValue;
  }

  get asteriskChannelId(): string | null {
    return this.asteriskChannelIdValue;
  }

  get asteriskBridgeId(): string | null {
    return this.asteriskBridgeIdValue;
  }

  get createdAt(): Date {
    return new Date(this.createdAtValue);
  }

  get lastStatusChangedAt(): Date {
    return new Date(this.lastStatusChangedAtValue);
  }

  get dialingAt(): Date | null {
    return this.dialingAtValue ? new Date(this.dialingAtValue) : null;
  }

  get ringingAt(): Date | null {
    return this.ringingAtValue ? new Date(this.ringingAtValue) : null;
  }

  get answeredAt(): Date | null {
    return this.answeredAtValue ? new Date(this.answeredAtValue) : null;
  }

  get endedAt(): Date | null {
    return this.endedAtValue ? new Date(this.endedAtValue) : null;
  }

  get terminationReason(): string | null {
    return this.terminationReasonValue;
  }

  get version(): number {
    return this.versionValue;
  }

  toSnapshot(): CallSnapshot {
    return {
      id: this.idValue,

      agentSessionId: this.agentSessionIdValue,

      sourcePhoneId: this.sourcePhoneIdValue,

      debtorId: this.debtorIdValue,

      contractId: this.contractIdValue,

      dialedE164Number: this.dialedE164NumberValue,

      dialedNationalNumber: this.dialedNationalNumberValue,

      phoneKind: this.phoneKindValue,

      status: this.statusValue,

      asteriskChannelId: this.asteriskChannelIdValue,

      asteriskBridgeId: this.asteriskBridgeIdValue,

      createdAt: new Date(this.createdAtValue),

      lastStatusChangedAt: new Date(this.lastStatusChangedAtValue),

      dialingAt: this.dialingAtValue ? new Date(this.dialingAtValue) : null,

      ringingAt: this.ringingAtValue ? new Date(this.ringingAtValue) : null,

      answeredAt: this.answeredAtValue ? new Date(this.answeredAtValue) : null,

      endedAt: this.endedAtValue ? new Date(this.endedAtValue) : null,

      terminationReason: this.terminationReasonValue,

      version: this.versionValue,
    };
  }

  private static requireText(
    value: string,
    code: string,
    message: string,
  ): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new DomainRuleViolationError({
        code,
        message,
      });
    }

    return normalized;
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
