import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gemsteps_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const PIN_PATTERN = /^\d{6}$/;
const SESSION_SCOPE = "gemsteps:session:v1";

export function isConfiguredPin(pin: string | undefined): pin is string {
  return PIN_PATTERN.test(pin ?? "");
}

export function isValidPin(candidate: string, configuredPin: string): boolean {
  if (!PIN_PATTERN.test(candidate) || !PIN_PATTERN.test(configuredPin)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(candidate), Buffer.from(configuredPin));
}

export function createSessionToken(configuredPin: string): string {
  if (!isConfiguredPin(configuredPin)) {
    throw new Error("GEMSTEPS_PIN must be exactly six digits");
  }

  return createHmac("sha256", configuredPin).update(SESSION_SCOPE).digest("base64url");
}

export function isValidSessionToken(
  token: string | undefined,
  configuredPin: string,
): boolean {
  if (!token || !isConfiguredPin(configuredPin)) return false;

  const expected = createSessionToken(configuredPin);
  const receivedBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}
