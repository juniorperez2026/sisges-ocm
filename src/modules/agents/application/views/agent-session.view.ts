import type { AgentSession } from '../../domain/agent-session';
import type { AgentStatus } from '../../domain/agent-status';

export interface AgentSessionView {
  readonly id: string;
  readonly agentId: string;
  readonly extensionId: string;
  readonly status: AgentStatus;
  readonly connectedAt: string;
  readonly disconnectedAt: string | null;
  readonly lastStatusChangedAt: string;
  readonly lastHeartbeatAt: string;
}

export function toAgentSessionView(session: AgentSession): AgentSessionView {
  return {
    id: session.id,
    agentId: session.agentId,
    extensionId: session.extensionId,
    status: session.status,
    connectedAt: session.connectedAt.toISOString(),
    disconnectedAt: session.disconnectedAt?.toISOString() ?? null,
    lastStatusChangedAt: session.lastStatusChangedAt.toISOString(),
    lastHeartbeatAt: session.lastHeartbeatAt.toISOString(),
  };
}
