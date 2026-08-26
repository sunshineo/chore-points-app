import { afterEach, describe, expect, it, vi } from "vitest";
import { internalServerError } from "@/lib/server/api-error";

afterEach(() => vi.restoreAllMocks());

describe("internalServerError", () => {
  it("returns a request ID without logging the raw exception message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(
      new Error("connection failed: postgresql://release-user:secret@localhost/gemsteps_release_test"),
      { code: "P1001" },
    );

    const response = internalServerError("points.get", error);
    const body = await response.json();
    const entry = JSON.parse(String(log.mock.calls[0]?.[0]));

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "服务器暂时无法处理请求",
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(entry).toEqual({
      level: "error",
      scope: "points.get",
      requestId: body.requestId,
      errorName: "Error",
      errorCode: "P1001",
    });
    expect(JSON.stringify(entry)).not.toContain("connection failed");
    expect(JSON.stringify(entry)).not.toContain("postgresql://");
  });

  it("logs a trusted classification instead of a mutable error name", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("synthetic failure"), {
      name: "DatabasePassword_synthetic-secret",
      code: "P1001",
    });

    const response = internalServerError("points.post", error);
    const body = await response.json();
    const entry = JSON.parse(String(log.mock.calls[0]?.[0]));

    expect(response.status).toBe(500);
    expect(entry).toEqual({
      level: "error",
      scope: "points.post",
      requestId: body.requestId,
      errorName: "Error",
      errorCode: "P1001",
    });
    expect(JSON.stringify(entry)).not.toContain("DatabasePassword");
    expect(JSON.stringify(entry)).not.toContain("synthetic-secret");
  });

  it("returns a generic 500 when hostile metadata getters throw", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("raw synthetic-route-secret");
    Object.defineProperties(error, {
      name: {
        get: () => {
          throw new Error("name getter synthetic-route-secret");
        },
      },
      code: {
        get: () => {
          throw new Error("code getter synthetic-route-secret");
        },
      },
    });

    const response = internalServerError("auth.get", error);
    const body = await response.json();
    const entry = JSON.parse(String(log.mock.calls[0]?.[0]));

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "服务器暂时无法处理请求",
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toHaveLength(1);
    expect(entry).toEqual({
      level: "error",
      scope: "auth.get",
      requestId: body.requestId,
      errorName: "Error",
    });
    expect(JSON.stringify(entry)).not.toContain("synthetic-route-secret");
  });
});
