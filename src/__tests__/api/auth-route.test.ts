import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import { GET, POST } from "@/app/api/auth/route";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isValidSessionToken,
} from "@/lib/auth";

const SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const NOW = Date.parse("2026-08-25T16:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("GEMSTEPS_PIN", "482731");
  vi.stubEnv("GEMSTEPS_SESSION_SECRET", SESSION_SECRET);
  cookieGet.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("auth route sessions", () => {
  it("returns and signs one shared absolute expiration", async () => {
    const response = await POST(new Request("http://localhost/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "482731" }),
    }));
    const body = await response.json();
    const token = response.cookies.get(SESSION_COOKIE)?.value;

    expect(body.expiresAt).toBe(NOW + SESSION_MAX_AGE_SECONDS * 1_000);
    expect(isValidSessionToken({
      token,
      configuredPin: "482731",
      sessionSecret: SESSION_SECRET,
      now: body.expiresAt - 1,
    })).toBe(true);
  });

  it("reports an embedded-expiration token as unauthenticated", async () => {
    const token = createSessionToken({
      configuredPin: "482731",
      sessionSecret: SESSION_SECRET,
      expiresAt: NOW - 1,
    });
    cookieGet.mockReturnValue({ value: token });

    const response = await GET();

    expect(await response.json()).toMatchObject({ authenticated: false, configured: true });
  });
});
