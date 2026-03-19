import type { RequestHandler, ErrorRequestHandler } from 'express';
import type { ReqId } from 'pino-http';
import { ZodError } from 'zod';
import { createLogger } from '@docscope/shared-utils';

const log = createLogger('api:error');

export function asyncHandler(fn: (...args: Parameters<RequestHandler>) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export class NotFoundError extends Error {
  constructor(message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export const notFoundMiddleware: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};

export const errorHandlerMiddleware: ErrorRequestHandler = (
  err,
  req,
  res,
  _next,
) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  const requestId = (req as { id?: ReqId }).id;
  log.error({ err, requestId }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};
