import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import { DELETE, GET, POST } from "@/app/api/auth/route";
import {
  SESSION_COOKIE,
  createSessionToken,
  isValidSessionToken,
} from "@/lib/auth";

const SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const NOW = Date.parse("2026-08-25T16:00:00.000Z");
const EXPIRES_AT = Date.parse("2026-09-24T16:00:00.000Z");

const authHandlers = [
  { method: "GET", call: () => GET() },
  {
    method: "POST",
    call: () => POST(new Request("http://localhost/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "482731" }),
    })),
  },
  { method: "DELETE", call: () => DELETE() },
];

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
    const cookie = response.cookies.get(SESSION_COOKIE);
    const token = cookie?.value;

    expect(body.expiresAt).toBe(EXPIRES_AT);
    expect(token?.split(".")[1]).toBe(String(EXPIRES_AT));
    expect(cookie?.expires).toEqual(new Date(EXPIRES_AT));
    expect(cookie?.maxAge).toBe(2_592_000);
    expect(isValidSessionToken({
      token,
      configuredPin: "482731",
      sessionSecret: SESSION_SECRET,
      now: EXPIRES_AT - 1,
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

  it.each(authHandlers)("$method returns 503 for an invalid configured PIN", async ({ call }) => {
    vi.stubEnv("GEMSTEPS_PIN", "12345");

    const response = await call();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "GemSteps authentication is not configured" });
  });

  it.each(authHandlers)("$method returns 503 for an invalid session secret", async ({ call }) => {
    vi.stubEnv("GEMSTEPS_SESSION_SECRET", "short");

    const response = await call();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "GemSteps authentication is not configured" });
  });

  it("expires the cookie while reporting invalid DELETE configuration", async () => {
    vi.stubEnv("GEMSTEPS_SESSION_SECRET", "short");

    const response = await DELETE();
    const cookie = response.cookies.get(SESSION_COOKIE);

    expect(response.status).toBe(503);
    expect(cookie?.value).toBe("");
    expect(cookie?.expires).toEqual(new Date(0));
  });
});
