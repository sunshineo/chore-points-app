import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  isConfiguredPin,
  isConfiguredSessionSecret,
  isValidSessionToken,
} from "@/lib/auth";
import {
  getDateKeyPT,
} from "@/lib/points";
import { isValidDateKey, parsePointEvent } from "@/lib/point-event";
import { applyPointEventToLedger, readPointsState } from "@/lib/server/point-ledger";

async function requireSession(): Promise<NextResponse | null> {
  const configuredPin = process.env.GEMSTEPS_PIN;
  const sessionSecret = process.env.GEMSTEPS_SESSION_SECRET;
  if (!isConfiguredPin(configuredPin) || !isConfiguredSessionSecret(sessionSecret)) {
    return NextResponse.json(
      { error: "GemSteps authentication is not configured" },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  if (!isValidSessionToken({
    token: cookieStore.get(SESSION_COOKIE)?.value,
    configuredPin,
    sessionSecret,
    now: Date.now(),
  })) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function parseDateParam(raw: string | null): string {
  const trimmed = raw?.trim() ?? "";
  return isValidDateKey(trimmed) ? trimmed : getDateKeyPT();
}

export async function GET(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const selectedDate = parseDateParam(new URL(req.url).searchParams.get("date"));
    return NextResponse.json(await readPointsState(prisma, selectedDate));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const event = parsePointEvent(await req.json().catch(() => null));
    if (!event) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const outcome = await applyPointEventToLedger(prisma, event);

    if (outcome === "rejected") {
      return NextResponse.json({ error: "Event rejected" }, { status: 409 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
