import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isConfiguredPin,
  isConfiguredSessionSecret,
  isValidPin,
  isValidSessionToken,
} from "@/lib/auth";

type UnlockRequest = {
  pin?: unknown;
};

export async function GET() {
  const configuredPin = process.env.GEMSTEPS_PIN;
  const sessionSecret = process.env.GEMSTEPS_SESSION_SECRET;
  if (!isConfiguredPin(configuredPin) || !isConfiguredSessionSecret(sessionSecret)) {
    return NextResponse.json(
      { error: "GemSteps authentication is not configured" },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const authenticated = isValidSessionToken({
    token: cookieStore.get(SESSION_COOKIE)?.value,
    configuredPin,
    sessionSecret,
    now: Date.now(),
  });

  return NextResponse.json({ authenticated, configured: true });
}

export async function POST(request: Request) {
  const configuredPin = process.env.GEMSTEPS_PIN;
  const sessionSecret = process.env.GEMSTEPS_SESSION_SECRET;
  if (!isConfiguredPin(configuredPin) || !isConfiguredSessionSecret(sessionSecret)) {
    return NextResponse.json(
      { error: "GemSteps authentication is not configured" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as UnlockRequest | null;
  const candidate = typeof body?.pin === "string" ? body.pin : "";
  if (!isValidPin(candidate, configuredPin)) {
    return NextResponse.json({ error: "密码不正确，请再试一次" }, { status: 401 });
  }

  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const token = createSessionToken({ configuredPin, sessionSecret, expiresAt });
  const response = NextResponse.json({ authenticated: true, expiresAt });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    expires: new Date(expiresAt),
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
