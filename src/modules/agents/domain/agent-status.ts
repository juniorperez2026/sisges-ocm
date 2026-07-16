export const AGENT_STATUS = {
  OFFLINE: 'OFFLINE',
  AVAILABLE: 'AVAILABLE',
  DIALING: 'DIALING',
  ON_CALL: 'ON_CALL',
  WRAP_UP: 'WRAP_UP',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

export const AGENT_STATUS_VALUES: readonly AgentStatus[] = Object.freeze(
  Object.values(AGENT_STATUS),
);
