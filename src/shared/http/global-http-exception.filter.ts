import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  APPLICATION_ERROR_KIND,
  ApplicationError,
  type ApplicationErrorKind,
} from '../application/application.error';
import { DomainRuleViolationError } from '../domain/domain-rule-violation.error';
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
  details?: Readonly<Record<string, unknown>>;
}

interface ResolvedException {
  statusCode: number;
  code: string;
  message: string | string[];
  details?: Readonly<Record<string, unknown>>;
}

const APPLICATION_STATUS_CODES: Readonly<Record<ApplicationErrorKind, number>> =
  {
    [APPLICATION_ERROR_KIND.NOT_FOUND]: Number(HttpStatus.NOT_FOUND),

    [APPLICATION_ERROR_KIND.CONFLICT]: Number(HttpStatus.CONFLICT),

    [APPLICATION_ERROR_KIND.VALIDATION]: Number(
      HttpStatus.UNPROCESSABLE_ENTITY,
    ),
  };

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();

    const request = httpContext.getRequest<CorrelatedRequest>();

    const response = httpContext.getResponse<Response>();

    const resolvedException = this.resolveException(exception);

    const correlationId =
      request.correlationId ??
      request.header(CORRELATION_ID_HEADER) ??
      'unavailable';

    const errorResponse: ErrorResponse = {
      statusCode: resolvedException.statusCode,
      code: resolvedException.code,
      message: resolvedException.message,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      correlationId,
      ...(resolvedException.details
        ? {
            details: resolvedException.details,
          }
        : {}),
    };

    const isServerError =
      resolvedException.statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR);

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

    response.status(resolvedException.statusCode).json(errorResponse);
  }

  private resolveException(exception: unknown): ResolvedException {
    if (exception instanceof ApplicationError) {
      return {
        statusCode: APPLICATION_STATUS_CODES[exception.kind],
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof DomainRuleViolationError) {
      return {
        statusCode: Number(HttpStatus.CONFLICT),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    return {
      statusCode: Number(HttpStatus.INTERNAL_SERVER_ERROR),
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
  }

  private resolveHttpException(exception: HttpException): ResolvedException {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        statusCode,
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
      statusCode,
      code: this.normalizeCode(rawCode),
      message,
      details: this.resolveDetails(responseObject.details),
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

  private resolveDetails(
    value: unknown,
  ): Readonly<Record<string, unknown>> | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined;
    }

    return value as Readonly<Record<string, unknown>>;
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
