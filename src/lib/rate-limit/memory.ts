import type { RateLimitResult, RateLimiter } from "./types";

export class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, at: number = Date.now()): RateLimitResult {
    const cutoff = at - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.limit) {
      const earliest = recent[0];
      this.hits.set(key, recent);
      return {
        ok: false,
        limit: this.limit,
        windowMs: this.windowMs,
        retryAfterMs: Math.max(0, earliest + this.windowMs - at),
        message: `Rate limit exceeded: ${this.limit} requests per ${this.windowMs}ms`,
      };
    }

    recent.push(at);
    this.hits.set(key, recent);

    return {
      ok: true,
      remaining: this.limit - recent.length,
      resetAt: at + this.windowMs,
    };
  }

  reset(): void {
    this.hits.clear();
  }
}
