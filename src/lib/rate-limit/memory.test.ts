import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "./memory";

describe("InMemoryRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = new InMemoryRateLimiter(2, 1_000);

    expect(limiter.check("client-a", 1_000)).toMatchObject({
      ok: true,
      remaining: 1,
      resetAt: 2_000,
    });
    expect(limiter.check("client-a", 1_100)).toMatchObject({
      ok: true,
      remaining: 0,
      resetAt: 2_100,
    });
  });

  it("denies requests at the limit until the window advances", () => {
    const limiter = new InMemoryRateLimiter(2, 1_000);

    limiter.check("client-a", 1_000);
    limiter.check("client-a", 1_100);

    expect(limiter.check("client-a", 1_200)).toMatchObject({
      ok: false,
      limit: 2,
      windowMs: 1_000,
      retryAfterMs: 800,
    });
    expect(limiter.check("client-a", 2_001).ok).toBe(true);
  });
});
