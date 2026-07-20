import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CancelCallUseCase } from '../../application/use-cases/cancel-call.use-case';
import { CreateCallUseCase } from '../../application/use-cases/create-call.use-case';
import { GetCallUseCase } from '../../application/use-cases/get-call.use-case';
import type { CallView } from '../../application/views/call.view';
import { CreateCallDto } from './dto/create-call.dto';

@Controller('calls')
export class CallsController {
  constructor(
    private readonly createCall: CreateCallUseCase,

    private readonly getCall: GetCallUseCase,

    private readonly cancelCall: CancelCallUseCase,
  ) {}

  @Post()
  create(@Body() dto: CreateCallDto): Promise<CallView> {
    return this.createCall.execute({
      agentSessionId: dto.agentSessionId,

      debtorId: dto.debtorId,

      sourcePhoneId: dto.sourcePhoneId,
    });
  }

  @Get(':callId')
  getById(
    @Param(
      'callId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    callId: string,
  ): Promise<CallView> {
    return this.getCall.execute(callId);
  }

  @Post(':callId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param(
      'callId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    callId: string,
  ): Promise<CallView> {
    return this.cancelCall.execute(callId);
  }
}
