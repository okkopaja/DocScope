import { Router } from 'express';
import { getDb } from '@docscope/db';
import { asyncHandler } from '../middleware/error-handler.js';

export const healthRouter: ReturnType<typeof Router> = Router();

healthRouter.get('/', asyncHandler(async (_req, res) => {
  const checks: Record<string, string> = {};

  // Postgres
  try {
    const db = getDb();
    await db.$queryRaw`SELECT 1`;
    checks['db'] = 'connected';
  } catch {
    checks['db'] = 'error';
  }

  // Redis
  try {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });
    await client.connect();
    await client.ping();
    await client.disconnect();
    checks['redis'] = 'connected';
  } catch {
    checks['redis'] = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'connected');
  const status = allOk ? 'ok' : 'degraded';
  res.status(allOk ? 200 : 503).json({ status, ...checks, timestamp: new Date().toISOString() });
}));
