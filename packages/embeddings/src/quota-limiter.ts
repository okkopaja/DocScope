/**
 * QuotaLimiter — token-bucket rate limiter for the Gemini Embedding API.
 *
 * Defaults: 1500 requests/minute (25 req/s).
 */
export class QuotaLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(options: { requestsPerMinute?: number } = {}) {
    const rpm = options.requestsPerMinute ?? 1500;
    this.maxTokens = rpm;
    this.tokens = rpm;
    this.refillRate = rpm / 60_000; // tokens per ms
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait until a token is available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await sleep(waitMs);
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
