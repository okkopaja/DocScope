import { createLogger } from '@docscope/shared-utils';

const log = createLogger('embeddings:retry');

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * RetryPolicy — exponential backoff: 1s → 2s → 4s → 8s → 30s cap.
 * Dead-letters after `maxAttempts` failures.
 */
export class RetryPolicy {
  private readonly options: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async execute<T>(
    operation: () => Promise<T>,
    context: string = 'operation',
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        const statusCode = this.extractStatusCode(err);
        const isRetryable =
          statusCode === null || this.options.retryableStatusCodes.includes(statusCode);

        if (!isRetryable || attempt === this.options.maxAttempts) {
          log.error({ attempt, context, statusCode, err }, 'Operation failed — giving up');
          throw err;
        }

        const delayMs = Math.min(
          this.options.initialDelayMs * 2 ** (attempt - 1),
          this.options.maxDelayMs,
        );
        log.warn({ attempt, context, statusCode, delayMs }, 'Retryable error — backing off');
        await sleep(delayMs);
      }
    }

    throw lastError;
  }

  private extractStatusCode(err: unknown): number | null {
    if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, unknown>;
      if (typeof e['status'] === 'number') return e['status'];
      if (typeof e['statusCode'] === 'number') return e['statusCode'];
      if (typeof e['code'] === 'number') return e['code'];
    }
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
