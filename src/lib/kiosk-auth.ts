import { createHmac, timingSafeEqual } from "node:crypto";

export const KIOSK_SESSION_COOKIE = "gemsteps_kiosk_session";
export const KIOSK_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const KIOSK_PIN_PATTERN = /^\d{6}$/;
const SESSION_SCOPE = "gemsteps-day:kiosk-session:v1";

export function isConfiguredKioskPin(pin: string | undefined): pin is string {
  return KIOSK_PIN_PATTERN.test(pin ?? "");
}

export function isValidKioskPin(candidate: string, configuredPin: string): boolean {
  if (!KIOSK_PIN_PATTERN.test(candidate) || !KIOSK_PIN_PATTERN.test(configuredPin)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(candidate), Buffer.from(configuredPin));
}

export function createKioskSessionToken(configuredPin: string): string {
  if (!isConfiguredKioskPin(configuredPin)) {
    throw new Error("KIOSK_PIN must be exactly six digits");
  }

  return createHmac("sha256", configuredPin).update(SESSION_SCOPE).digest("base64url");
}

export function isValidKioskSessionToken(
  token: string | undefined,
  configuredPin: string,
): boolean {
  if (!token || !isConfiguredKioskPin(configuredPin)) return false;

  const expected = createKioskSessionToken(configuredPin);
  const receivedBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}
