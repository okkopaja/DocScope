import { Router } from 'express';
import { getDb } from '@docscope/db';
import { NotFoundError, asyncHandler } from '../middleware/error-handler.js';

export const jobsRouter: ReturnType<typeof Router> = Router();

// GET /jobs/:jobId
jobsRouter.get('/:jobId', asyncHandler(async (req, res) => {
  const db = getDb();
  const job = await db.job.findUnique({
    where: { id: req.params['jobId'] },
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!job) throw new NotFoundError(`Job ${req.params['jobId']} not found`);
  res.json(job);
}));
