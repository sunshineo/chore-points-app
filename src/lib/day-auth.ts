import { createHmac } from "crypto";

const KIOSK_PIN = process.env.KIOSK_PIN || "000000";
const SECRET = process.env.NEXTAUTH_SECRET || "kiosk-fallback-secret";

function generateToken(): string {
  return createHmac("sha256", SECRET).update(`day-kiosk:${KIOSK_PIN}`).digest("hex").slice(0, 32);
}

export function getDefaultDayToken(): string {
  return generateToken();
}

export function verifyDayToken(token: string): boolean {
  return token === generateToken();
}
