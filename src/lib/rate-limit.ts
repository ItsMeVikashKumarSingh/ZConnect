import { NextRequest } from 'next/server';

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitTracker>();

/**
 * Basic sliding-window rate limiter for Next.js Route Handlers.
 * @param req NextRequest
 * @param limit Maximum allowed requests per window
 * @param windowMs Window duration in milliseconds (default 60 seconds)
 */
export function checkRateLimit(
  req: NextRequest,
  limit: number = 60,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; reset: number } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
  const pathname = req.nextUrl.pathname;
  const key = `${ip}:${pathname}`;
  const now = Date.now();

  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    const tracker: RateLimitTracker = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitMap.set(key, tracker);
    return { allowed: true, remaining: limit - 1, reset: tracker.resetTime };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, reset: current.resetTime };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count, reset: current.resetTime };
}
