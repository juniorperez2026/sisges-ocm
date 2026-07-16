import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';

export type CorrelatedRequest = Request & {
  correlationId?: string;
};

const VALID_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    request: CorrelatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    const receivedCorrelationId = request.header(CORRELATION_ID_HEADER)?.trim();

    const correlationId =
      receivedCorrelationId && VALID_CORRELATION_ID.test(receivedCorrelationId)
        ? receivedCorrelationId
        : randomUUID();

    request.correlationId = correlationId;

    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
