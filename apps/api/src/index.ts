import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { createLogger } from '@docscope/shared-utils';
import { requestIdMiddleware } from './middleware/request-id.js';
import { rateLimiterMiddleware } from './middleware/rate-limiter.js';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { workspacesRouter } from './routes/workspaces.js';
import { jobsRouter } from './routes/jobs.js';

const log = createLogger('api');
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

const app: Express = express();

// -----------------------------------------------------------------------
// Middleware stack
// -----------------------------------------------------------------------

// 1. Request ID
app.use(requestIdMiddleware);

// 2. Pino HTTP logger
app.use(pinoHttp({ logger: log }));

// 3. Helmet security headers
app.use(helmet());

// 4. CORS — localhost only
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS: only localhost origins allowed'));
      }
    },
    credentials: true,
  }),
);

// 5. Cookie parser
app.use(cookieParser());

// 6. JSON body with size limit
app.use(express.json({ limit: '10mb' }));

// 7. Rate limiter (applied on admin routes)
app.use('/workspaces', rateLimiterMiddleware);
app.use('/jobs', rateLimiterMiddleware);

// Phase 1: Authentication/session middleware is intentionally omitted.
// The API is designed for localhost-only access. Auth will be added in Phase 2.

// -----------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------

app.use('/health', healthRouter);
app.use('/workspaces', workspacesRouter);
app.use('/jobs', jobsRouter);

// -----------------------------------------------------------------------
// Error handling
// -----------------------------------------------------------------------

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// -----------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------

if (process.env['DOCSCOPE_DISABLE_LISTEN'] !== '1') {
  app.listen(PORT, '127.0.0.1', () => {
    log.info({ port: PORT }, 'DocScope API listening');
  });
}

export { app };
