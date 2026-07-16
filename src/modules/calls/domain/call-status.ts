export const CALL_STATUS = {
  CREATED: 'CREATED',
  CONNECTING: 'CONNECTING',
  DIALING: 'DIALING',
  RINGING: 'RINGING',
  ANSWERED: 'ANSWERED',
  ENDING: 'ENDING',
  ENDED: 'ENDED',
  FAILED: 'FAILED',
  BUSY: 'BUSY',
  NO_ANSWER: 'NO_ANSWER',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type CallStatus = (typeof CALL_STATUS)[keyof typeof CALL_STATUS];

export const CALL_STATUS_VALUES: readonly CallStatus[] = Object.freeze(
  Object.values(CALL_STATUS),
);
