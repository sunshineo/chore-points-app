import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  isConfiguredPin,
  isConfiguredSessionSecret,
  isValidPin,
  isValidSessionToken,
} from "@/lib/auth";

describe("auth", () => {
  it("accepts only a six-digit configured PIN", () => {
    expect(isConfiguredPin("482731")).toBe(true);
    expect(isConfiguredPin("12345")).toBe(false);
    expect(isConfiguredPin("12345a")).toBe(false);
  });

  it("validates an entered PIN exactly", () => {
    expect(isValidPin("482731", "482731")).toBe(true);
    expect(isValidPin("482730", "482731")).toBe(false);
  });

  it("signs an expiring token with a high-entropy secret", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    const expiresAt = Date.parse("2026-09-24T00:00:00.000Z");
    const token = createSessionToken({ configuredPin: "482731", sessionSecret: secret, expiresAt });

    expect(isValidSessionToken({
      token,
      configuredPin: "482731",
      sessionSecret: secret,
      now: expiresAt - 1,
    })).toBe(true);
    expect(isValidSessionToken({
      token,
      configuredPin: "482731",
      sessionSecret: secret,
      now: expiresAt,
    })).toBe(false);
    expect(isValidSessionToken({
      token,
      configuredPin: "482730",
      sessionSecret: secret,
      now: expiresAt - 1,
    })).toBe(false);
    expect(isValidSessionToken({
      token,
      configuredPin: "482731",
      sessionSecret: `${secret}x`,
      now: expiresAt - 1,
    })).toBe(false);
    expect(isValidSessionToken({
      token: `${token}.suffix`,
      configuredPin: "482731",
      sessionSecret: secret,
      now: expiresAt - 1,
    })).toBe(false);
  });

  it("requires at least 32 bytes of session secret", () => {
    expect(isConfiguredSessionSecret("short")).toBe(false);
    expect(isConfiguredSessionSecret("0123456789abcdef0123456789abcdef")).toBe(true);
  });
});
