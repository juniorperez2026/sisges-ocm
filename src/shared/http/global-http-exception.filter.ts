import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';
import type { CorrelatedRequest } from './correlation-id.middleware';

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string | string[];
  timestamp: string;
  path: string;
  method: string;
  correlationId: string;
}

interface ResolvedException {
  code: string;
  message: string | string[];
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();

    const request = httpContext.getRequest<CorrelatedRequest>();
    const response = httpContext.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isServerError =
      statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR);

    const resolvedException = this.resolveException(exception, statusCode);

    const correlationId =
      request.correlationId ??
      request.header(CORRELATION_ID_HEADER) ??
      'unavailable';

    const errorResponse: ErrorResponse = {
      statusCode,
      code: resolvedException.code,
      message: resolvedException.message,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      correlationId,
    };

    const logData = {
      event: 'http_request_failed',
      ...errorResponse,
      errorName: exception instanceof Error ? exception.name : 'UnknownError',
      stack:
        isServerError && exception instanceof Error
          ? exception.stack
          : undefined,
    };

    if (isServerError) {
      this.logger.error(logData);
    } else {
      this.logger.warn(logData);
    }

    response.status(statusCode).json(errorResponse);
  }

  private resolveException(
    exception: unknown,
    statusCode: number,
  ): ResolvedException {
    if (!(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      };
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        code: `HTTP_${statusCode}`,
        message: exceptionResponse,
      };
    }

    const responseObject = exceptionResponse as Record<string, unknown>;

    const message = this.resolveMessage(
      responseObject.message,
      exception.message,
    );

    const rawCode =
      typeof responseObject.code === 'string'
        ? responseObject.code
        : typeof responseObject.error === 'string'
          ? responseObject.error
          : `HTTP_${statusCode}`;

    return {
      code: this.normalizeCode(rawCode),
      message,
    };
  }

  private resolveMessage(value: unknown, fallback: string): string | string[] {
    if (typeof value === 'string') {
      return value;
    }

    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    ) {
      return value;
    }

    return fallback;
  }

  private normalizeCode(value: string): string {
    const normalized = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalized || 'HTTP_ERROR';
  }
}
