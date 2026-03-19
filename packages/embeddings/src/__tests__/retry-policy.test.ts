import { describe, it, expect } from 'vitest';
import { RetryPolicy } from '../retry-policy.js';

describe('RetryPolicy', () => {
  it('returns on first success', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, initialDelayMs: 10 });
    const result = await policy.execute(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('retries on retryable error then succeeds', async () => {
    let calls = 0;
    const policy = new RetryPolicy({ maxAttempts: 3, initialDelayMs: 10 });
    const result = await policy.execute(async () => {
      calls++;
      if (calls < 3) {
        const err = new Error('transient') as Error & { status: number };
        err.status = 503;
        throw err;
      }
      return 'recovered';
    });
    expect(result).toBe('recovered');
    expect(calls).toBe(3);
  });

  it('throws immediately on non-retryable error', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, initialDelayMs: 10 });
    await expect(
      policy.execute(async () => {
        const err = new Error('bad request') as Error & { status: number };
        err.status = 400;
        throw err;
      }),
    ).rejects.toThrow('bad request');
  });

  it('gives up after maxAttempts', async () => {
    let calls = 0;
    const policy = new RetryPolicy({ maxAttempts: 2, initialDelayMs: 10 });
    await expect(
      policy.execute(async () => {
        calls++;
        const err = new Error('always fail') as Error & { status: number };
        err.status = 500;
        throw err;
      }),
    ).rejects.toThrow('always fail');
    expect(calls).toBe(2);
  });
});
