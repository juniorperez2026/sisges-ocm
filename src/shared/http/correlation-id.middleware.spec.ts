import type { NextFunction, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';
import {
  CorrelationIdMiddleware,
  type CorrelatedRequest,
} from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('preserves a valid incoming correlation ID', () => {
    const incomingCorrelationId = 'request-test-001';

    const header = jest
      .fn<(name: string) => string | undefined>()
      .mockReturnValue(incomingCorrelationId);

    const setHeader = jest.fn<(name: string, value: string) => void>();

    const next = jest.fn<NextFunction>();

    const request = {
      header,
    } as unknown as CorrelatedRequest;

    const response = {
      setHeader,
    } as unknown as Response;

    middleware.use(request, response, next);

    expect(header).toHaveBeenCalledWith(CORRELATION_ID_HEADER);

    expect(request.correlationId).toBe(incomingCorrelationId);

    expect(setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      incomingCorrelationId,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a UUID when the incoming value is invalid', () => {
    const header = jest
      .fn<(name: string) => string | undefined>()
      .mockReturnValue('invalid correlation id');

    const setHeader = jest.fn<(name: string, value: string) => void>();

    const next = jest.fn<NextFunction>();

    const request = {
      header,
    } as unknown as CorrelatedRequest;

    const response = {
      setHeader,
    } as unknown as Response;

    middleware.use(request, response, next);

    expect(request.correlationId).toEqual(
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    );

    expect(request.correlationId).not.toBe('invalid correlation id');

    expect(setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      request.correlationId,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });
});
