import { handlers } from "@/lib/auth";
import { authRateLimiter, checkRateLimit } from "@/lib/rate-limit";

// Wrap POST handler with rate limiting for login attempts
async function rateLimitedPost(req: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const params = await context.params;

  // Only rate limit credential sign-in attempts, not OAuth callbacks
  if (params.nextauth?.includes("callback") && params.nextauth?.includes("credentials")) {
    const rateLimitResponse = checkRateLimit(req, authRateLimiter);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  return handlers.POST(req, context);
}

export const GET = handlers.GET;
export const POST = rateLimitedPost;
