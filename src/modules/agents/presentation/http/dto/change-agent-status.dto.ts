import { IsIn } from 'class-validator';
import {
  AGENT_STATUS_VALUES,
  type AgentStatus,
} from '../../../domain/agent-status';

export class ChangeAgentStatusDto {
  @IsIn(AGENT_STATUS_VALUES)
  status!: AgentStatus;
}
