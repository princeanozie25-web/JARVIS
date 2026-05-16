import { rateLimitConfig } from "./config";
import { InMemoryRateLimiter } from "./memory";
import type { RateLimiter } from "./types";

export const rateLimiter: RateLimiter = new InMemoryRateLimiter(
  rateLimitConfig.limit,
  rateLimitConfig.windowMs,
);

export function clientKeyFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anonymous";
}

export { InMemoryRateLimiter } from "./memory";
export { rateLimitConfig } from "./config";
export type {
  RateLimitAllow,
  RateLimitDeny,
  RateLimiter,
  RateLimitResult,
} from "./types";
