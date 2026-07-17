import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ChangeAgentStatusUseCase } from '../../application/use-cases/change-agent-status.use-case';
import { DisconnectAgentSessionUseCase } from '../../application/use-cases/disconnect-agent-session.use-case';
import { GetAgentSessionUseCase } from '../../application/use-cases/get-agent-session.use-case';
import { HeartbeatAgentSessionUseCase } from '../../application/use-cases/heartbeat-agent-session.use-case';
import { StartAgentSessionUseCase } from '../../application/use-cases/start-agent-session.use-case';
import type { AgentSessionView } from '../../application/views/agent-session.view';
import { ChangeAgentStatusDto } from './dto/change-agent-status.dto';
import { StartAgentSessionDto } from './dto/start-agent-session.dto';

@Controller('agent-sessions')
export class AgentSessionsController {
  constructor(
    private readonly startAgentSession: StartAgentSessionUseCase,
    private readonly getAgentSession: GetAgentSessionUseCase,
    private readonly changeAgentStatus: ChangeAgentStatusUseCase,
    private readonly heartbeatAgentSession: HeartbeatAgentSessionUseCase,
    private readonly disconnectAgentSession: DisconnectAgentSessionUseCase,
  ) {}

  @Post()
  start(@Body() dto: StartAgentSessionDto): Promise<AgentSessionView> {
    return this.startAgentSession.execute({
      agentId: dto.agentId,
      extensionId: dto.extensionId,
    });
  }

  @Get(':sessionId')
  getById(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' }))
    sessionId: string,
  ): Promise<AgentSessionView> {
    return this.getAgentSession.execute(sessionId);
  }

  @Patch(':sessionId/status')
  changeStatus(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' }))
    sessionId: string,
    @Body() dto: ChangeAgentStatusDto,
  ): Promise<AgentSessionView> {
    return this.changeAgentStatus.execute({
      sessionId,
      status: dto.status,
    });
  }

  @Post(':sessionId/heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' }))
    sessionId: string,
  ): Promise<AgentSessionView> {
    return this.heartbeatAgentSession.execute(sessionId);
  }

  @Post(':sessionId/disconnect')
  @HttpCode(HttpStatus.OK)
  disconnect(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' }))
    sessionId: string,
  ): Promise<AgentSessionView> {
    return this.disconnectAgentSession.execute(sessionId);
  }
}
