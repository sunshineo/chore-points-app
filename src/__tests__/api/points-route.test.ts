import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "test-session" }) }),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({
  SESSION_COOKIE: "gemsteps-session",
  isConfiguredPin: (value: unknown) => value === "123456",
  isConfiguredSessionSecret: (value: unknown) => typeof value === "string",
  isValidSessionToken: () => true,
}));

import { POST } from "@/app/api/points/route";

const validEvent = {
  id: "event-1",
  type: "task",
  itemId: "seed-task-face",
  points: 1,
  dateKey: "2026-08-25",
  date: "2026-08-25T16:00:00.000Z",
};

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/points validation", () => {
  it.each([
    { ...validEvent, dateKey: "2026-02-31" },
    { ...validEvent, dateKey: "2026-08-24" },
  ])("rejects an impossible or Pacific-mismatched date", async (event) => {
    vi.stubEnv("GEMSTEPS_PIN", "123456");
    vi.stubEnv("GEMSTEPS_SESSION_SECRET", "test-session-secret-at-least-32-chars");
    const response = await POST(new Request("http://localhost/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }));

    expect(response.status).toBe(400);
  });
});
