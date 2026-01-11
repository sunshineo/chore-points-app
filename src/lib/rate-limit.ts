/**
 * Rate Limiting Utility for Next.js API Routes
 *
 * This implementation uses an in-memory store with automatic cleanup.
 * For production at scale, consider using Redis or Upstash.
 *
 * Usage:
 *   const limiter = rateLimit({ limit: 5, windowMs: 60000 });
 *   const result = await limiter.check(request);
 *   if (!result.success) {
 *     return NextResponse.json({ error: result.message }, { status: 429 });
 *   }
 */

import { NextResponse } from "next/server";

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Identifier function - extracts unique key from request (default: IP address) */
  keyGenerator?: (request: Request) => string;
  /** Custom message when rate limited */
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  message?: string;
}

// In-memory store for rate limiting
// Note: This resets when the server restarts and doesn't work across multiple instances
// For production, use Redis/Upstash: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Extract client IP from request headers
 * Works with Vercel, Cloudflare, and standard proxies
 */
function getClientIp(request: Request): string {
  const headers = request.headers;

  // Vercel
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Cloudflare
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Real IP header (nginx)
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback
  return "unknown";
}

/**
 * Create a rate limiter with the specified configuration
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    limit,
    windowMs,
    keyGenerator = getClientIp,
    message = "Too many requests, please try again later",
  } = config;

  return {
    /**
     * Check if the request is within rate limits
     */
    check(request: Request): RateLimitResult {
      cleanupExpiredEntries();

      const key = keyGenerator(request);
      const now = Date.now();
      const entry = rateLimitStore.get(key);

      // First request or window expired
      if (!entry || entry.resetTime < now) {
        const resetTime = now + windowMs;
        rateLimitStore.set(key, { count: 1, resetTime });
        return {
          success: true,
          limit,
          remaining: limit - 1,
          resetTime,
        };
      }

      // Within existing window
      entry.count++;
      rateLimitStore.set(key, entry);

      if (entry.count > limit) {
        return {
          success: false,
          limit,
          remaining: 0,
          resetTime: entry.resetTime,
          message,
        };
      }

      return {
        success: true,
        limit,
        remaining: limit - entry.count,
        resetTime: entry.resetTime,
      };
    },

    /**
     * Add rate limit headers to a response
     */
    headers(result: RateLimitResult): Headers {
      const headers = new Headers();
      headers.set("X-RateLimit-Limit", result.limit.toString());
      headers.set("X-RateLimit-Remaining", result.remaining.toString());
      headers.set("X-RateLimit-Reset", result.resetTime.toString());
      if (!result.success) {
        headers.set(
          "Retry-After",
          Math.ceil((result.resetTime - Date.now()) / 1000).toString()
        );
      }
      return headers;
    },
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Strict limiter for auth endpoints (signup, login attempts)
// 5 requests per minute per IP
export const authRateLimiter = rateLimit({
  limit: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "5", 10),
  windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || "60", 10) * 1000,
  message: "Too many authentication attempts. Please wait before trying again.",
});

// Moderate limiter for sensitive operations (family join, password reset)
// 10 requests per minute per IP
export const sensitiveRateLimiter = rateLimit({
  limit: 10,
  windowMs: 60 * 1000,
  message: "Too many requests. Please wait before trying again.",
});

// General API limiter
// 100 requests per minute per IP
export const apiRateLimiter = rateLimit({
  limit: parseInt(process.env.RATE_LIMIT_API_MAX || "100", 10),
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW || "60", 10) * 1000,
  message: "Rate limit exceeded. Please slow down your requests.",
});

/**
 * Helper to create a rate-limited response
 */
export function rateLimitedResponse(
  result: RateLimitResult
): NextResponse {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", "0");
  headers.set("X-RateLimit-Reset", result.resetTime.toString());
  headers.set(
    "Retry-After",
    Math.ceil((result.resetTime - Date.now()) / 1000).toString()
  );

  return NextResponse.json(
    { error: result.message },
    { status: 429, headers }
  );
}

/**
 * Middleware helper for rate limiting
 * Returns null if allowed, or a 429 response if rate limited
 */
export function checkRateLimit(
  request: Request,
  limiter: ReturnType<typeof rateLimit>
): NextResponse | null {
  const result = limiter.check(request);
  if (!result.success) {
    return rateLimitedResponse(result);
  }
  return null;
}
