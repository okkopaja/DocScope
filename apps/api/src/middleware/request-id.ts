import type { RequestHandler } from 'express';
import type { ReqId } from 'pino-http';
import { randomUUID } from 'node:crypto';

export const requestIdMiddleware: RequestHandler = (req, _res, next) => {
  const reqWithId = req as { id?: ReqId };
  reqWithId.id = randomUUID();
  next();
};
