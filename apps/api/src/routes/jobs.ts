import { Router } from 'express';
import { getDb } from '@docscope/db';
import { NotFoundError, asyncHandler } from '../middleware/error-handler.js';

export const jobsRouter: ReturnType<typeof Router> = Router();

// GET /jobs/:jobId
jobsRouter.get('/:jobId', asyncHandler(async (req, res) => {
  const db = getDb();
  const jobId = req.params['jobId'] as string;
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!job) throw new NotFoundError(`Job ${jobId} not found`);
  res.json(job);
}));
