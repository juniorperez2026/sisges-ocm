import type { Call, CallPhoneKind } from '../../domain/call';
import type { CallStatus } from '../../domain/call-status';

export interface CallView {
  readonly id: string;

  readonly agentSessionId: string;

  readonly sourcePhoneId: string;

  readonly debtorId: string;

  readonly contractId: string | null;

  readonly maskedPhoneNumber: string;

  readonly phoneKind: CallPhoneKind;

  readonly status: CallStatus;

  readonly createdAt: string;

  readonly lastStatusChangedAt: string;

  readonly dialingAt: string | null;

  readonly ringingAt: string | null;

  readonly answeredAt: string | null;

  readonly endedAt: string | null;

  readonly terminationReason: string | null;
}

export function toCallView(call: Call): CallView {
  return {
    id: call.id,

    agentSessionId: call.agentSessionId,

    sourcePhoneId: call.sourcePhoneId,

    debtorId: call.debtorId,

    contractId: call.contractId,

    maskedPhoneNumber: maskPhoneNumber(call.dialedE164Number),

    phoneKind: call.phoneKind,

    status: call.status,

    createdAt: call.createdAt.toISOString(),

    lastStatusChangedAt: call.lastStatusChangedAt.toISOString(),

    dialingAt: call.dialingAt?.toISOString() ?? null,

    ringingAt: call.ringingAt?.toISOString() ?? null,

    answeredAt: call.answeredAt?.toISOString() ?? null,

    endedAt: call.endedAt?.toISOString() ?? null,

    terminationReason: call.terminationReason,
  };
}

function maskPhoneNumber(phoneNumber: string): string {
  const ending = phoneNumber.slice(-3);

  const prefix = phoneNumber.startsWith('+51') ? '+51' : '';

  const hiddenLength = Math.max(
    phoneNumber.length - prefix.length - ending.length,
    3,
  );

  return `${prefix}${'*'.repeat(hiddenLength)}${ending}`;
}
