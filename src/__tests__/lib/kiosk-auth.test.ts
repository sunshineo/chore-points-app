import { describe, expect, it } from "vitest";
import {
  createKioskSessionToken,
  isConfiguredKioskPin,
  isValidKioskPin,
  isValidKioskSessionToken,
} from "@/lib/kiosk-auth";

describe("kiosk auth", () => {
  it("accepts only a six-digit configured PIN", () => {
    expect(isConfiguredKioskPin("482731")).toBe(true);
    expect(isConfiguredKioskPin("12345")).toBe(false);
    expect(isConfiguredKioskPin("12345a")).toBe(false);
  });

  it("validates an entered PIN exactly", () => {
    expect(isValidKioskPin("482731", "482731")).toBe(true);
    expect(isValidKioskPin("482730", "482731")).toBe(false);
  });

  it("creates a stable session token tied to the configured PIN", () => {
    const token = createKioskSessionToken("482731");

    expect(isValidKioskSessionToken(token, "482731")).toBe(true);
    expect(isValidKioskSessionToken(token, "482730")).toBe(false);
    expect(isValidKioskSessionToken(`${token}x`, "482731")).toBe(false);
  });
});
