import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const KIOSK_PIN = process.env.KIOSK_PIN || "0000";
const SECRET = process.env.NEXTAUTH_SECRET || "kiosk-fallback-secret";

// Generate a simple HMAC token from the PIN
function generateToken(): string {
  return createHmac("sha256", SECRET).update(`kiosk:${KIOSK_PIN}`).digest("hex").slice(0, 32);
}

export function verifyKioskToken(token: string): boolean {
  return token === generateToken();
}

export async function POST(req: NextRequest) {
  const { pin } = await req.json();

  if (!pin || pin !== KIOSK_PIN) {
    // Add a small delay to deter brute force
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const token = generateToken();
  return NextResponse.json({ token });
}
