export interface RateLimitAllow {
  ok: true;
  remaining: number;
  resetAt: number;
}

export interface RateLimitDeny {
  ok: false;
  limit: number;
  windowMs: number;
  retryAfterMs: number;
  message: string;
}

export type RateLimitResult = RateLimitAllow | RateLimitDeny;

export interface RateLimiter {
  check(key: string, at?: number): RateLimitResult;
  reset(): void;
}
