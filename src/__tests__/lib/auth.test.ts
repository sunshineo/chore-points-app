import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  isConfiguredPin,
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

  it("creates a stable session token tied to the configured PIN", () => {
    const token = createSessionToken("482731");

    expect(isValidSessionToken(token, "482731")).toBe(true);
    expect(isValidSessionToken(token, "482730")).toBe(false);
    expect(isValidSessionToken(`${token}x`, "482731")).toBe(false);
  });
});
