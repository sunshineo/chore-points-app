import { afterEach, describe, expect, it, vi } from "vitest";

const ledger = vi.hoisted(() => ({
  applyPointEventToLedger: vi.fn(),
  readPointsState: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "test-session" }) }),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, isValidSessionToken: () => true };
});
vi.mock("@/lib/server/point-ledger", () => ledger);

import { GET, POST } from "@/app/api/points/route";

const validEvent = {
  id: "event-1",
  type: "task",
  itemId: "seed-task-face",
  points: 1,
  dateKey: "2026-08-25",
  date: "2026-08-25T16:00:00.000Z",
};
const SESSION_SECRET = "test-session-secret-at-least-32-chars";

const pointsHandlers = [
  {
    method: "GET",
    call: () => GET(new Request("http://localhost/api/points?date=2026-08-25")),
  },
  {
    method: "POST",
    call: () => POST(new Request("http://localhost/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validEvent),
    })),
  },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/points validation", () => {
  it.each([
    { ...validEvent, dateKey: "2026-02-31" },
    { ...validEvent, dateKey: "2026-08-24" },
  ])("rejects an impossible or Pacific-mismatched date", async (event) => {
    vi.stubEnv("GEMSTEPS_PIN", "123456");
    vi.stubEnv("GEMSTEPS_SESSION_SECRET", SESSION_SECRET);
    const response = await POST(new Request("http://localhost/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }));

    expect(response.status).toBe(400);
  });

  it.each(pointsHandlers)("$method returns 503 for an invalid configured PIN", async ({ call }) => {
    vi.stubEnv("GEMSTEPS_PIN", "12345");
    vi.stubEnv("GEMSTEPS_SESSION_SECRET", SESSION_SECRET);

    const response = await call();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "GemSteps authentication is not configured" });
  });

  it.each(pointsHandlers)("$method returns 503 for an invalid session secret", async ({ call }) => {
    vi.stubEnv("GEMSTEPS_PIN", "123456");
    vi.stubEnv("GEMSTEPS_SESSION_SECRET", "short");

    const response = await call();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "GemSteps authentication is not configured" });
  });

  it.each([
    { ...pointsHandlers[0], fail: ledger.readPointsState },
    { ...pointsHandlers[1], fail: ledger.applyPointEventToLedger },
  ])("$method does not disclose unexpected failures", async ({ call, fail }) => {
    vi.stubEnv("GEMSTEPS_PIN", "123456");
    vi.stubEnv("GEMSTEPS_SESSION_SECRET", SESSION_SECRET);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fail.mockRejectedValueOnce(
      new Error("connection failed: postgresql://release-user:secret@localhost/gemsteps_release_test"),
    );

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "服务器暂时无法处理请求",
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    });
    expect(JSON.stringify(body)).not.toContain("postgresql://");
    expect(JSON.stringify(log.mock.calls)).not.toContain("postgresql://");
  });
});
