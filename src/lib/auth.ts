import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gemsteps_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const PIN_PATTERN = /^\d{6}$/;
const SESSION_SCOPE = "gemsteps:session:v1";
const SESSION_VERSION = "1";

export function isConfiguredPin(pin: string | undefined): pin is string {
  return PIN_PATTERN.test(pin ?? "");
}

export function isValidPin(candidate: string, configuredPin: string): boolean {
  if (!PIN_PATTERN.test(candidate) || !PIN_PATTERN.test(configuredPin)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(candidate), Buffer.from(configuredPin));
}

export function isConfiguredSessionSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && Buffer.byteLength(secret, "utf8") >= 32;
}

type CreateSessionTokenOptions = {
  configuredPin: string;
  sessionSecret: string;
  expiresAt: number;
};

type ValidateSessionTokenOptions = {
  token: string | undefined;
  configuredPin: string;
  sessionSecret: string;
  now?: number;
};

function signature(payload: string, configuredPin: string, sessionSecret: string): string {
  return createHmac("sha256", sessionSecret)
    .update(`${SESSION_SCOPE}:${configuredPin}:${payload}`)
    .digest("base64url");
}

export function createSessionToken({
  configuredPin,
  sessionSecret,
  expiresAt,
}: CreateSessionTokenOptions): string {
  if (!isConfiguredPin(configuredPin)) {
    throw new Error("GEMSTEPS_PIN must be exactly six digits");
  }
  if (!isConfiguredSessionSecret(sessionSecret)) {
    throw new Error("GEMSTEPS_SESSION_SECRET must contain at least 32 bytes");
  }
  if (!Number.isSafeInteger(expiresAt)) {
    throw new Error("Session expiration is invalid");
  }

  const payload = `${SESSION_VERSION}.${expiresAt}`;
  return `${payload}.${signature(payload, configuredPin, sessionSecret)}`;
}

export function isValidSessionToken({
  token,
  configuredPin,
  sessionSecret,
  now = Date.now(),
}: ValidateSessionTokenOptions): boolean {
  if (!token || !isConfiguredPin(configuredPin) || !isConfiguredSessionSecret(sessionSecret)) {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, rawExpiresAt, received] = parts;
  const expiresAt = Number(rawExpiresAt);
  if (
    version !== SESSION_VERSION ||
    !Number.isSafeInteger(expiresAt) ||
    rawExpiresAt !== String(expiresAt) ||
    expiresAt <= now ||
    !received
  ) {
    return false;
  }

  const payload = `${version}.${rawExpiresAt}`;
  const expected = signature(payload, configuredPin, sessionSecret);
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}
