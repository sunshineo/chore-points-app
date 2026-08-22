import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isConfiguredPin,
  isValidPin,
  isValidSessionToken,
} from "@/lib/auth";

type UnlockRequest = {
  pin?: unknown;
};

function getConfiguredPin(): string | null {
  const pin = process.env.GEMSTEPS_PIN;
  return isConfiguredPin(pin) ? pin : null;
}

export async function GET() {
  const configuredPin = getConfiguredPin();
  if (!configuredPin) {
    return NextResponse.json(
      { authenticated: false, configured: false },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const authenticated = isValidSessionToken(
    cookieStore.get(SESSION_COOKIE)?.value,
    configuredPin,
  );

  return NextResponse.json({ authenticated, configured: true });
}

export async function POST(request: Request) {
  const configuredPin = getConfiguredPin();
  if (!configuredPin) {
    return NextResponse.json(
      { error: "管理员还没有配置六位数字密码" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as UnlockRequest | null;
  const candidate = typeof body?.pin === "string" ? body.pin : "";
  if (!isValidPin(candidate, configuredPin)) {
    return NextResponse.json({ error: "密码不正确，请再试一次" }, { status: 401 });
  }

  const response = NextResponse.json({
    authenticated: true,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionToken(configuredPin),
    httpOnly: true,
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
