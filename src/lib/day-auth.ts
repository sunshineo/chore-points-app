import { createHmac } from "crypto";

const DAY_PIN = process.env.DAY_PIN || "000000";
const SECRET = process.env.DAY_SECRET || process.env.NEXTAUTH_SECRET || "day-fallback-secret";

function generateToken(): string {
  return createHmac("sha256", SECRET).update(`gemsteps-day:${DAY_PIN}`).digest("hex").slice(0, 32);
}

export function getDefaultDayToken(): string {
  return process.env.DAY_TOKEN || generateToken();
}

export function verifyDayToken(token: string): boolean {
  return token === getDefaultDayToken();
}
